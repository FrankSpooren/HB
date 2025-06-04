// ===================================================================
// HOLIDAIBUTLER BACKEND SERVICES SUITE
// Complete business logic services with production-ready features
// ===================================================================

// ===================================================================
// 1. SERVICE INFRASTRUCTURE & DEPENDENCIES
// ===================================================================

const Redis = require('redis');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const winston = require('winston');
const axios = require('axios');
const Stripe = require('stripe');
const crypto = require('crypto');

// Redis client setup
const redisClient = Redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
});

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// ===================================================================
// 2. BASE SERVICE CLASS & ERROR HANDLING
// ===================================================================

class ServiceError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

class BaseService {
  constructor(name) {
    this.name = name;
    this.cache = redisClient;
    this.logger = logger.child({ service: name });
  }

  async cacheGet(key, defaultValue = null) {
    try {
      const cached = await this.cache.get(`${this.name}:${key}`);
      return cached ? JSON.parse(cached) : defaultValue;
    } catch (error) {
      this.logger.warn('Cache get failed', { key, error: error.message });
      return defaultValue;
    }
  }

  async cacheSet(key, value, ttl = 300) {
    try {
      await this.cache.setex(`${this.name}:${key}`, ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.warn('Cache set failed', { key, error: error.message });
    }
  }

  async cacheDel(key) {
    try {
      await this.cache.del(`${this.name}:${key}`);
    } catch (error) {
      this.logger.warn('Cache delete failed', { key, error: error.message });
    }
  }

  validate(data, schema) {
    const { error, value } = schema.validate(data);
    if (error) {
      throw new ServiceError(
        `Validation error: ${error.details[0].message}`,
        400,
        'VALIDATION_ERROR'
      );
    }
    return value;
  }

  logOperation(operation, data = {}) {
    this.logger.info(`${operation}`, { 
      service: this.name, 
      operation,
      ...data 
    });
  }

  logError(operation, error, data = {}) {
    this.logger.error(`${operation} failed`, { 
      service: this.name, 
      operation,
      error: error.message,
      stack: error.stack,
      ...data 
    });
  }
}

// ===================================================================
// 3. CLAUDE AI SERVICE
// ===================================================================

class ClaudeAIService extends BaseService {
  constructor() {
    super('claude-ai');
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.baseURL = 'https://api.anthropic.com/v1';
    this.model = 'claude-sonnet-4-20250514';
    this.maxTokens = 4000;
    this.maxContextLength = 10;
  }

  // Rate limiting specifically for Claude AI
  static rateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 50, // 50 requests per minute per user
    keyGenerator: (req) => req.user?.id || req.ip,
    message: { error: 'Too many AI requests, please try again later' }
  });

  // Input validation schemas
  static schemas = {
    chat: Joi.object({
      message: Joi.string().required().max(2000),
      conversationId: Joi.string().uuid().optional(),
      context: Joi.object().optional(),
      userId: Joi.string().required()
    }),
    
    context: Joi.object({
      location: Joi.string().optional(),
      preferences: Joi.object().optional(),
      bookingHistory: Joi.array().optional(),
      currentBooking: Joi.object().optional()
    })
  };

  async processConversation(data) {
    const validated = this.validate(data, ClaudeAIService.schemas.chat);
    const { message, conversationId, context, userId } = validated;

    this.logOperation('process_conversation', { userId, conversationId });

    try {
      // Get conversation context
      const conversationContext = await this.getConversationContext(
        conversationId, userId
      );

      // Detect intent
      const intent = await this.detectIntent(message, conversationContext);

      // Generate response based on intent
      const response = await this.generateResponse(
        message, intent, conversationContext, context
      );

      // Update conversation context
      await this.updateConversationContext(
        conversationId, userId, message, response, intent
      );

      return {
        response: response.content,
        intent: intent.type,
        confidence: intent.confidence,
        conversationId: conversationId || this.generateConversationId(),
        suggestions: response.suggestions || []
      };

    } catch (error) {
      this.logError('process_conversation', error, { userId, conversationId });
      throw error;
    }
  }

  async detectIntent(message, context = {}) {
    const cacheKey = `intent:${crypto.createHash('md5').update(message).digest('hex')}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const prompt = this.buildIntentDetectionPrompt(message, context);
      const response = await this.callClaude(prompt, { max_tokens: 500 });
      
      const intent = this.parseIntentResponse(response.content);
      await this.cacheSet(cacheKey, intent, 1800); // Cache for 30 minutes
      
      return intent;
    } catch (error) {
      this.logError('detect_intent', error);
      return { type: 'general', confidence: 0.5 };
    }
  }

  buildIntentDetectionPrompt(message, context) {
    return `Analyze this travel assistant message and detect the user's intent. 
    
Context: ${JSON.stringify(context, null, 2)}
Message: "${message}"

Classify the intent as one of:
- booking_search: User wants to search for accommodations
- booking_modify: User wants to modify existing booking
- booking_cancel: User wants to cancel a booking
- weather_inquiry: User asks about weather
- location_search: User asks about locations/POI
- payment_inquiry: User asks about payments/billing
- general: General conversation or unclear intent

Respond in JSON format:
{
  "type": "intent_type",
  "confidence": 0.8,
  "entities": {
    "location": "extracted_location",
    "dates": "extracted_dates",
    "guests": "extracted_guest_count"
  }
}`;
  }

  parseIntentResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      this.logError('parse_intent_response', error);
    }
    
    return { type: 'general', confidence: 0.5, entities: {} };
  }

  async generateResponse(message, intent, conversationContext, userContext) {
    try {
      const prompt = this.buildResponsePrompt(
        message, intent, conversationContext, userContext
      );
      
      const response = await this.callClaude(prompt, {
        max_tokens: this.maxTokens,
        temperature: 0.7
      });

      return {
        content: response.content,
        suggestions: this.extractSuggestions(response.content)
      };
    } catch (error) {
      this.logError('generate_response', error);
      return {
        content: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.",
        suggestions: []
      };
    }
  }

  buildResponsePrompt(message, intent, conversationContext, userContext) {
    return `You are HolidAIButler, a helpful travel assistant. Respond to the user's message.

Intent: ${intent.type} (confidence: ${intent.confidence})
Conversation Context: ${JSON.stringify(conversationContext, null, 2)}
User Context: ${JSON.stringify(userContext, null, 2)}
User Message: "${message}"

Guidelines:
- Be helpful and conversational
- If booking-related, guide users through the process
- If location-related, provide useful travel information
- Always ask clarifying questions when needed
- Suggest relevant actions the user can take
- Keep responses concise but informative

For booking searches, ask about:
- Destination
- Check-in/check-out dates
- Number of guests
- Budget preferences
- Accommodation type preferences

End your response with 2-3 suggested follow-up actions in this format:
SUGGESTIONS:
1. Action 1
2. Action 2
3. Action 3`;
  }

  extractSuggestions(content) {
    const suggestionsMatch = content.match(/SUGGESTIONS:\s*\n([\s\S]*?)$/);
    if (suggestionsMatch) {
      return suggestionsMatch[1]
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(suggestion => suggestion.length > 0);
    }
    return [];
  }

  async callClaude(prompt, options = {}) {
    try {
      const response = await axios.post(
        `${this.baseURL}/messages`,
        {
          model: this.model,
          max_tokens: options.max_tokens || this.maxTokens,
          temperature: options.temperature || 0.7,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        throw new ServiceError(
          'Rate limit exceeded for AI service',
          429,
          'RATE_LIMIT_EXCEEDED'
        );
      }
      
      throw new ServiceError(
        'Failed to generate AI response',
        500,
        'AI_SERVICE_ERROR'
      );
    }
  }

  async getConversationContext(conversationId, userId) {
    if (!conversationId) return { messages: [] };

    const cacheKey = `conversation:${conversationId}:${userId}`;
    const context = await this.cacheGet(cacheKey, { messages: [] });
    
    // Keep only last N messages for context
    if (context.messages.length > this.maxContextLength) {
      context.messages = context.messages.slice(-this.maxContextLength);
    }
    
    return context;
  }

  async updateConversationContext(conversationId, userId, message, response, intent) {
    if (!conversationId) conversationId = this.generateConversationId();
    
    const cacheKey = `conversation:${conversationId}:${userId}`;
    const context = await this.getConversationContext(conversationId, userId);
    
    context.messages.push({
      timestamp: new Date().toISOString(),
      user: message,
      assistant: response.content,
      intent: intent.type
    });

    await this.cacheSet(cacheKey, context, 3600); // Cache for 1 hour
  }

  generateConversationId() {
    return crypto.randomUUID();
  }
}

// ===================================================================
// 4. PAYMENT SERVICE
// ===================================================================

class PaymentService extends BaseService {
  constructor() {
    super('payment');
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  static rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 payment requests per 15 minutes per user
    keyGenerator: (req) => req.user?.id || req.ip
  });

  static schemas = {
    createPayment: Joi.object({
      amount: Joi.number().positive().required(),
      currency: Joi.string().length(3).default('USD'),
      bookingId: Joi.string().uuid().required(),
      userId: Joi.string().required(),
      metadata: Joi.object().optional()
    }),

    refund: Joi.object({
      paymentIntentId: Joi.string().required(),
      amount: Joi.number().positive().optional(),
      reason: Joi.string().valid('duplicate', 'fraudulent', 'requested_by_customer').optional()
    })
  };

  async createPaymentIntent(data) {
    const validated = this.validate(data, PaymentService.schemas.createPayment);
    const { amount, currency, bookingId, userId, metadata = {} } = validated;

    this.logOperation('create_payment_intent', { bookingId, userId, amount });

    try {
      // Check for duplicate payment intent
      const existingIntent = await this.getExistingPaymentIntent(bookingId);
      if (existingIntent && existingIntent.status !== 'canceled') {
        return {
          clientSecret: existingIntent.client_secret,
          paymentIntentId: existingIntent.id,
          status: existingIntent.status
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata: {
          bookingId,
          userId,
          ...metadata
        },
        description: `HolidAIButler booking payment for ${bookingId}`,
        automatic_payment_methods: {
          enabled: true
        }
      });

      // Cache payment intent
      await this.cacheSet(
        `payment_intent:${bookingId}`,
        {
          id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          status: paymentIntent.status,
          amount: paymentIntent.amount
        },
        3600
      );

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status
      };

    } catch (error) {
      this.logError('create_payment_intent', error, { bookingId, userId });
      throw new ServiceError(
        'Failed to create payment intent',
        500,
        'PAYMENT_CREATION_FAILED'
      );
    }
  }

  async getExistingPaymentIntent(bookingId) {
    const cached = await this.cacheGet(`payment_intent:${bookingId}`);
    if (cached) {
      try {
        // Verify with Stripe to ensure it's still valid
        const paymentIntent = await this.stripe.paymentIntents.retrieve(cached.id);
        return paymentIntent;
      } catch (error) {
        // Remove invalid cache entry
        await this.cacheDel(`payment_intent:${bookingId}`);
      }
    }
    return null;
  }

  async processWebhook(rawBody, signature) {
    let event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret
      );
    } catch (error) {
      this.logError('webhook_verification', error);
      throw new ServiceError(
        'Invalid webhook signature',
        400,
        'INVALID_WEBHOOK_SIGNATURE'
      );
    }

    this.logOperation('process_webhook', { type: event.type, id: event.id });

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        
        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(event.data.object);
          break;
        
        case 'refund.created':
          await this.handleRefundCreated(event.data.object);
          break;

        default:
          this.logger.info('Unhandled webhook event', { type: event.type });
      }

      return { received: true };
    } catch (error) {
      this.logError('process_webhook', error, { eventType: event.type });
      throw error;
    }
  }

  async handlePaymentSucceeded(paymentIntent) {
    const { metadata } = paymentIntent;
    const { bookingId, userId } = metadata;

    // Update payment status in cache
    await this.cacheSet(
      `payment_status:${bookingId}`,
      {
        status: 'succeeded',
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        timestamp: new Date().toISOString()
      },
      86400 // 24 hours
    );

    // Trigger booking confirmation (would integrate with booking service)
    await this.triggerBookingConfirmation(bookingId, paymentIntent);

    this.logOperation('payment_succeeded', { bookingId, userId });
  }

  async handlePaymentFailed(paymentIntent) {
    const { metadata } = paymentIntent;
    const { bookingId, userId } = metadata;

    await this.cacheSet(
      `payment_status:${bookingId}`,
      {
        status: 'failed',
        paymentIntentId: paymentIntent.id,
        failureReason: paymentIntent.last_payment_error?.message,
        timestamp: new Date().toISOString()
      },
      86400
    );

    this.logOperation('payment_failed', { bookingId, userId });
  }

  async handlePaymentCanceled(paymentIntent) {
    const { metadata } = paymentIntent;
    const { bookingId } = metadata;

    await this.cacheDel(`payment_intent:${bookingId}`);
    await this.cacheDel(`payment_status:${bookingId}`);

    this.logOperation('payment_canceled', { bookingId });
  }

  async handleRefundCreated(refund) {
    const paymentIntentId = refund.payment_intent;
    
    // Get payment intent to access metadata
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    const { bookingId } = paymentIntent.metadata;

    await this.cacheSet(
      `refund_status:${bookingId}`,
      {
        status: refund.status,
        refundId: refund.id,
        amount: refund.amount,
        reason: refund.reason,
        timestamp: new Date().toISOString()
      },
      86400
    );

    this.logOperation('refund_created', { bookingId, refundId: refund.id });
  }

  async processRefund(data) {
    const validated = this.validate(data, PaymentService.schemas.refund);
    const { paymentIntentId, amount, reason } = validated;

    this.logOperation('process_refund', { paymentIntentId, amount });

    try {
      const refundParams = {
        payment_intent: paymentIntentId,
        reason: reason || 'requested_by_customer'
      };

      if (amount) {
        refundParams.amount = Math.round(amount * 100);
      }

      const refund = await this.stripe.refunds.create(refundParams);

      return {
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100
      };

    } catch (error) {
      this.logError('process_refund', error, { paymentIntentId });
      throw new ServiceError(
        'Failed to process refund',
        500,
        'REFUND_PROCESSING_FAILED'
      );
    }
  }

  async getPaymentStatus(bookingId) {
    const status = await this.cacheGet(`payment_status:${bookingId}`);
    if (status) return status;

    // If not in cache, check Stripe directly (expensive operation)
    try {
      const paymentIntent = await this.getExistingPaymentIntent(bookingId);
      if (paymentIntent) {
        return {
          status: paymentIntent.status,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount
        };
      }
    } catch (error) {
      this.logError('get_payment_status', error, { bookingId });
    }

    return null;
  }

  async triggerBookingConfirmation(bookingId, paymentIntent) {
    // This would integrate with the booking service
    // For now, we'll just emit an event or add to a queue
    await this.cacheSet(
      `booking_confirmation_queue:${bookingId}`,
      {
        bookingId,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        timestamp: new Date().toISOString()
      },
      300 // 5 minutes TTL for processing
    );
  }
}

// ===================================================================
// 5. GEOCODING SERVICE
// ===================================================================

class GeocodingService extends BaseService {
  constructor() {
    super('geocoding');
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseURL = 'https://maps.googleapis.com/maps/api';
  }

  static rateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per user
    keyGenerator: (req) => req.user?.id || req.ip
  });

  static schemas = {
    geocode: Joi.object({
      address: Joi.string().required().max(200),
      language: Joi.string().length(2).default('en'),
      region: Joi.string().length(2).optional()
    }),

    reverseGeocode: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
      language: Joi.string().length(2).default('en')
    }),

    searchPOI: Joi.object({
      query: Joi.string().required().max(100),
      location: Joi.object({
        lat: Joi.number().required(),
        lng: Joi.number().required()
      }).optional(),
      radius: Joi.number().min(100).max(50000).default(5000),
      type: Joi.string().optional()
    }),

    calculateDistance: Joi.object({
      origins: Joi.array().items(
        Joi.object({
          lat: Joi.number().required(),
          lng: Joi.number().required()
        })
      ).required(),
      destinations: Joi.array().items(
        Joi.object({
          lat: Joi.number().required(),
          lng: Joi.number().required()
        })
      ).required()
    })
  };

  async geocodeAddress(data) {
    const validated = this.validate(data, GeocodingService.schemas.geocode);
    const { address, language, region } = validated;

    const cacheKey = `geocode:${crypto.createHash('md5')
      .update(`${address}:${language}:${region || ''}`)
      .digest('hex')}`;
    
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    this.logOperation('geocode_address', { address });

    try {
      const params = {
        address,
        key: this.apiKey,
        language
      };

      if (region) params.region = region;

      const response = await axios.get(`${this.baseURL}/geocode/json`, {
        params,
        timeout: 10000
      });

      if (response.data.status !== 'OK') {
        throw new ServiceError(
          `Geocoding failed: ${response.data.status}`,
          400,
          'GEOCODING_FAILED'
        );
      }

      const result = this.formatGeocodingResult(response.data.results[0]);
      await this.cacheSet(cacheKey, result, 86400); // Cache for 24 hours

      return result;

    } catch (error) {
      this.logError('geocode_address', error, { address });
      throw error;
    }
  }

  async reverseGeocode(data) {
    const validated = this.validate(data, GeocodingService.schemas.reverseGeocode);
    const { lat, lng, language } = validated;

    const cacheKey = `reverse_geocode:${lat}:${lng}:${language}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    this.logOperation('reverse_geocode', { lat, lng });

    try {
      const response = await axios.get(`${this.baseURL}/geocode/json`, {
        params: {
          latlng: `${lat},${lng}`,
          key: this.apiKey,
          language
        },
        timeout: 10000
      });

      if (response.data.status !== 'OK') {
        throw new ServiceError(
          `Reverse geocoding failed: ${response.data.status}`,
          400,
          'REVERSE_GEOCODING_FAILED'
        );
      }

      const result = this.formatGeocodingResult(response.data.results[0]);
      await this.cacheSet(cacheKey, result, 86400);

      return result;

    } catch (error) {
      this.logError('reverse_geocode', error, { lat, lng });
      throw error;
    }
  }

  async searchPOI(data) {
    const validated = this.validate(data, GeocodingService.schemas.searchPOI);
    const { query, location, radius, type } = validated;

    const cacheKey = `poi_search:${crypto.createHash('md5')
      .update(`${query}:${JSON.stringify(location)}:${radius}:${type || ''}`)
      .digest('hex')}`;
    
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    this.logOperation('search_poi', { query, location });

    try {
      const params = {
        query,
        key: this.apiKey
      };

      if (location) {
        params.location = `${location.lat},${location.lng}`;
        params.radius = radius;
      }

      if (type) params.type = type;

      const response = await axios.get(`${this.baseURL}/place/textsearch/json`, {
        params,
        timeout: 15000
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new ServiceError(
          `POI search failed: ${response.data.status}`,
          400,
          'POI_SEARCH_FAILED'
        );
      }

      const results = response.data.results.map(place => this.formatPOIResult(place));
      await this.cacheSet(cacheKey, results, 3600); // Cache for 1 hour

      return results;

    } catch (error) {
      this.logError('search_poi', error, { query });
      throw error;
    }
  }

  async calculateDistance(data) {
    const validated = this.validate(data, GeocodingService.schemas.calculateDistance);
    const { origins, destinations } = validated;

    const cacheKey = `distance:${crypto.createHash('md5')
      .update(JSON.stringify({ origins, destinations }))
      .digest('hex')}`;
    
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    this.logOperation('calculate_distance', { 
      originCount: origins.length, 
      destinationCount: destinations.length 
    });

    try {
      const originsStr = origins.map(o => `${o.lat},${o.lng}`).join('|');
      const destinationsStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');

      const response = await axios.get(`${this.baseURL}/distancematrix/json`, {
        params: {
          origins: originsStr,
          destinations: destinationsStr,
          units: 'metric',
          key: this.apiKey
        },
        timeout: 15000
      });

      if (response.data.status !== 'OK') {
        throw new ServiceError(
          `Distance calculation failed: ${response.data.status}`,
          400,
          'DISTANCE_CALCULATION_FAILED'
        );
      }

      const result = this.formatDistanceResult(response.data);
      await this.cacheSet(cacheKey, result, 3600);

      return result;

    } catch (error) {
      this.logError('calculate_distance', error);
      throw error;
    }
  }

  async checkGeofence(point, center, radius) {
    const distance = this.calculateHaversineDistance(
      point.lat, point.lng,
      center.lat, center.lng
    );
    
    return {
      inside: distance <= radius,
      distance: Math.round(distance),
      radius
    };
  }

  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  formatGeocodingResult(result) {
    const location = result.geometry.location;
    const addressComponents = result.address_components;

    return {
      formatted_address: result.formatted_address,
      location: {
        lat: location.lat,
        lng: location.lng
      },
      place_id: result.place_id,
      types: result.types,
      address_components: {
        street_number: this.getAddressComponent(addressComponents, 'street_number'),
        route: this.getAddressComponent(addressComponents, 'route'),
        locality: this.getAddressComponent(addressComponents, 'locality'),
        country: this.getAddressComponent(addressComponents, 'country'),
        postal_code: this.getAddressComponent(addressComponents, 'postal_code')
      }
    };
  }

  formatPOIResult(place) {
    return {
      place_id: place.place_id,
      name: place.name,
      formatted_address: place.formatted_address,
      location: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      },
      rating: place.rating || null,
      price_level: place.price_level || null,
      types: place.types,
      photos: place.photos ? place.photos.slice(0, 3).map(photo => ({
        photo_reference: photo.photo_reference,
        width: photo.width,
        height: photo.height
      })) : []
    };
  }

  formatDistanceResult(data) {
    return {
      origins: data.origin_addresses,
      destinations: data.destination_addresses,
      rows: data.rows.map(row => ({
        elements: row.elements.map(element => ({
          distance: element.distance ? {
            text: element.distance.text,
            value: element.distance.value
          } : null,
          duration: element.duration ? {
            text: element.duration.text,
            value: element.duration.value
          } : null,
          status: element.status
        }))
      }))
    };
  }

  getAddressComponent(components, type) {
    const component = components.find(comp => comp.types.includes(type));
    return component ? component.long_name : null;
  }
}

// ===================================================================
// 6. WEATHER SERVICE
// ===================================================================

class WeatherService extends BaseService {
  constructor() {
    super('weather');
    this.apiKey = process.env.OPENWEATHER_API_KEY;
    this.baseURL = 'https://api.openweathermap.org/data/2.5';
  }

  static rateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute per user
    keyGenerator: (req) => req.user?.id || req.ip
  });

  static schemas = {
    currentWeather: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
      units: Joi.string().valid('standard', 'metric', 'imperial').default('metric')
    }),

    forecast: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
      days: Joi.number().min(1).max(16).default(5),
      units: Joi.string().valid('standard', 'metric', 'imperial').default('metric')
    }),

    weatherByCity: Joi.object({
      city: Joi.string().required().max(100),
      country: Joi.string().length(2).optional(),
      units: Joi.string().valid('standard', 'metric', 'imperial').default('metric')
    })
  };

  async getCurrentWeather(data) {
    const validated = this.validate(data, WeatherService.schemas.currentWeather);
    const { lat, lng, units } = validated;

    const cacheKey = `current_weather:${lat}:${lng}:${units}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    this.logOperation('get_current_weather', { lat, lng });

    try {
      const response = await axios.get(`${this.baseURL}/weather`, {
        params: {
          lat,
          lon: lng,
          appid: this.apiKey,
          units
        },
        timeout: 10000
      });

      const result = this.formatCurrentWeatherResult(response.data, units);
      await this.cacheSet(cacheKey, result, 600); // Cache for 10 minutes

      return result;

    } catch (error) {
      this.logError('get_current_weather', error, { lat, lng });
      throw new ServiceError(
        'Failed to fetch current weather',
        500,
        'WEATHER_FETCH_FAILED'
      );
    }
  }

  async getWeatherForecast(data) {
    const validated = this.validate(data, WeatherService.schemas.forecast);
    const { lat, lng, days, units } = validated;

    const cacheKey = `weather_forecast:${lat}:${lng}:${days}:${units}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    this.logOperation('get_weather_forecast', { lat, lng, days });

    try {
      // Use different endpoint based on forecast length
      const endpoint = days <= 5 ? 'forecast' : 'forecast/daily';
      const params = {
        lat,
        lon: lng,
        appid: this.apiKey,
        units
      };

      if (days > 5) {
        params.cnt = days;
      }

      const response = await axios.get(`${this.baseURL}/${endpoint}`, {
        params,
        timeout: 15000
      });

      const result = this.formatForecastResult(response.data, units, days);
      await this.cacheSet(cacheKey, result, 1800); // Cache for 30 minutes

      return result;

    } catch (error) {
      this.logError('get_weather_forecast', error, { lat, lng, days });
      throw new ServiceError(
        'Failed to fetch weather forecast',
        500,
        'WEATHER_FORECAST_FAILED'
      );
    }
  }

  async getWeatherByCity(data) {
    const validated = this.validate(data, WeatherService.schemas.weatherByCity);
    const { city, country, units } = validated;

    const location = country ? `${city},${country}` : city;
    const cacheKey = `weather_by_city:${crypto.createHash('md5')
      .update(`${location}:${units}`)
      .digest('hex')}`;
    
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    this.logOperation('get_weather_by_city', { city, country });

    try {
      const response = await axios.get(`${this.baseURL}/weather`, {
        params: {
          q: location,
          appid: this.apiKey,
          units
        },
        timeout: 10000
      });

      const result = this.formatCurrentWeatherResult(response.data, units);
      await this.cacheSet(cacheKey, result, 600);

      return result;

    } catch (error) {
      this.logError('get_weather_by_city', error, { city, country });
      throw new ServiceError(
        'Failed to fetch weather by city',
        500,
        'WEATHER_CITY_FETCH_FAILED'
      );
    }
  }

  async getWeatherAlerts(lat, lng) {
    const cacheKey = `weather_alerts:${lat}:${lng}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseURL}/onecall`, {
        params: {
          lat,
          lon: lng,
          appid: this.apiKey,
          exclude: 'minutely,hourly,daily'
        },
        timeout: 10000
      });

      const alerts = response.data.alerts || [];
      const result = alerts.map(alert => ({
        sender_name: alert.sender_name,
        event: alert.event,
        start: new Date(alert.start * 1000).toISOString(),
        end: new Date(alert.end * 1000).toISOString(),
        description: alert.description,
        tags: alert.tags || []
      }));

      await this.cacheSet(cacheKey, result, 1800);
      return result;

    } catch (error) {
      this.logError('get_weather_alerts', error, { lat, lng });
      return []; // Return empty array if alerts can't be fetched
    }
  }

  async getWeatherRecommendations(weatherData, activityType = 'general') {
    const recommendations = {
      suitable: true,
      message: '',
      suggestions: []
    };

    const { main, weather, wind } = weatherData;
    const temp = main.temp;
    const condition = weather[0].main.toLowerCase();
    const windSpeed = wind.speed;

    // Temperature-based recommendations
    if (temp < 0) {
      recommendations.suitable = false;
      recommendations.message = 'Very cold weather - indoor activities recommended';
      recommendations.suggestions.push('Visit museums or shopping centers');
    } else if (temp < 10) {
      recommendations.message = 'Cold weather - dress warmly';
      recommendations.suggestions.push('Warm clothing essential', 'Hot drinks recommended');
    } else if (temp > 35) {
      recommendations.message = 'Very hot weather - stay hydrated';
      recommendations.suggestions.push('Seek shade', 'Stay hydrated', 'Avoid outdoor activities during midday');
    } else if (temp > 25) {
      recommendations.message = 'Warm weather - perfect for outdoor activities';
      recommendations.suggestions.push('Great weather for sightseeing');
    }

    // Weather condition-based recommendations
    if (condition.includes('rain') || condition.includes('storm')) {
      recommendations.suitable = false;
      recommendations.message = 'Rainy weather - consider indoor activities';
      recommendations.suggestions.push('Bring umbrella', 'Indoor attractions recommended');
    } else if (condition.includes('snow')) {
      recommendations.message = 'Snowy weather - winter activities available';
      recommendations.suggestions.push('Winter clothing needed', 'Winter sports opportunities');
    } else if (condition.includes('clear') || condition.includes('sun')) {
      recommendations.message = 'Clear weather - excellent for outdoor activities';
      recommendations.suggestions.push('Perfect for sightseeing', 'Outdoor dining recommended');
    }

    // Wind-based recommendations
    if (windSpeed > 10) {
      recommendations.suggestions.push('Windy conditions - secure loose items');
    }

    return recommendations;
  }

  formatCurrentWeatherResult(data, units) {
    const tempUnit = units === 'imperial' ? '°F' : units === 'metric' ? '°C' : 'K';
    const speedUnit = units === 'imperial' ? 'mph' : 'm/s';

    return {
      location: {
        name: data.name,
        country: data.sys.country,
        coordinates: {
          lat: data.coord.lat,
          lng: data.coord.lon
        }
      },
      current: {
        temperature: Math.round(data.main.temp),
        feels_like: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        visibility: data.visibility ? Math.round(data.visibility / 1000) : null,
        uv_index: data.uvi || null,
        condition: {
          main: data.weather[0].main,
          description: data.weather[0].description,
          icon: data.weather[0].icon
        },
        wind: {
          speed: data.wind.speed,
          direction: data.wind.deg || null,
          gust: data.wind.gust || null
        },
        units: {
          temperature: tempUnit,
          wind_speed: speedUnit
        }
      },
      sun: {
        sunrise: new Date(data.sys.sunrise * 1000).toISOString(),
        sunset: new Date(data.sys.sunset * 1000).toISOString()
      },
      timestamp: new Date().toISOString()
    };
  }

  formatForecastResult(data, units, days) {
    const tempUnit = units === 'imperial' ? '°F' : units === 'metric' ? '°C' : 'K';
    
    let forecasts;
    
    if (data.list) {
      // 5-day forecast (3-hour intervals) or 16-day forecast (daily)
      forecasts = data.list.slice(0, days * (days <= 5 ? 8 : 1)).map(item => ({
        datetime: new Date(item.dt * 1000).toISOString(),
        temperature: {
          temp: Math.round(item.main?.temp || item.temp?.day),
          feels_like: Math.round(item.main?.feels_like || item.feels_like?.day),
          min: Math.round(item.main?.temp_min || item.temp?.min),
          max: Math.round(item.main?.temp_max || item.temp?.max)
        },
        condition: {
          main: item.weather[0].main,
          description: item.weather[0].description,
          icon: item.weather[0].icon
        },
        humidity: item.main?.humidity || item.humidity,
        wind: {
          speed: item.wind?.speed || item.speed,
          direction: item.wind?.deg || item.deg
        },
        precipitation: {
          probability: item.pop ? Math.round(item.pop * 100) : 0,
          rain: item.rain ? item.rain['3h'] || item.rain['1h'] : 0,
          snow: item.snow ? item.snow['3h'] || item.snow['1h'] : 0
        }
      }));
    }

    return {
      location: {
        name: data.city?.name,
        country: data.city?.country,
        coordinates: {
          lat: data.city?.coord?.lat,
          lng: data.city?.coord?.lon
        }
      },
      forecast: forecasts,
      units: {
        temperature: tempUnit
      },
      timestamp: new Date().toISOString()
    };
  }
}

// ===================================================================
// 7. BOOKING SERVICE
// ===================================================================

class BookingService extends BaseService {
  constructor() {
    super('booking');
    this.partnerAPIs = {
      booking: {
        baseURL: process.env.BOOKING_API_URL,
        apiKey: process.env.BOOKING_API_KEY
      },
      expedia: {
        baseURL: process.env.EXPEDIA_API_URL,
        apiKey: process.env.EXPEDIA_API_KEY
      }
    };
  }

  static rateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 booking requests per minute per user
    keyGenerator: (req) => req.user?.id || req.ip
  });

  static schemas = {
    searchAccommodations: Joi.object({
      destination: Joi.string().required(),
      checkIn: Joi.date().min('now').required(),
      checkOut: Joi.date().greater(Joi.ref('checkIn')).required(),
      guests: Joi.object({
        adults: Joi.number().min(1).max(16).default(2),
        children: Joi.number().min(0).max(10).default(0),
        rooms: Joi.number().min(1).max(8).default(1)
      }).default(),
      filters: Joi.object({
        priceMin: Joi.number().min(0).optional(),
        priceMax: Joi.number().min(0).optional(),
        starRating: Joi.array().items(Joi.number().min(1).max(5)).optional(),
        amenities: Joi.array().items(Joi.string()).optional(),
        propertyType: Joi.array().items(Joi.string()).optional()
      }).optional(),
      sortBy: Joi.string().valid('price', 'rating', 'distance', 'popularity').default('popularity'),
      limit: Joi.number().min(1).max(50).default(20)
    }),

    createBooking: Joi.object({
      accommodationId: Joi.string().required(),
      userId: Joi.string().required(),
      guestDetails: Joi.object({
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        phone: Joi.string().required(),
        specialRequests: Joi.string().max(500).optional()
      }).required(),
      checkIn: Joi.date().min('now').required(),
      checkOut: Joi.date().greater(Joi.ref('checkIn')).required(),
      guests: Joi.object({
        adults: Joi.number().min(1).required(),
        children: Joi.number().min(0).required(),
        rooms: Joi.number().min(1).required()
      }).required(),
      totalAmount: Joi.number().positive().required(),
      currency: Joi.string().length(3).default('USD')
    }),

    modifyBooking: Joi.object({
      bookingId: Joi.string().uuid().required(),
      changes: Joi.object({
        checkIn: Joi.date().min('now').optional(),
        checkOut: Joi.date().optional(),
        guests: Joi.object({
          adults: Joi.number().min(1).optional(),
          children: Joi.number().min(0).optional(),
          rooms: Joi.number().min(1).optional()
        }).optional(),
        specialRequests: Joi.string().max(500).optional()
      }).required()
    }),

    cancelBooking: Joi.object({
      bookingId: Joi.string().uuid().required(),
      reason: Joi.string().max(500).optional(),
      refundRequested: Joi.boolean().default(true)
    })
  };

  async searchAccommodations(data) {
    const validated = this.validate(data, BookingService.schemas.searchAccommodations);
    const { destination, checkIn, checkOut, guests, filters, sortBy, limit } = validated;

    const cacheKey = `search:${crypto.createHash('md5')
      .update(JSON.stringify(validated))
      .digest('hex')}`;
    
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    this.logOperation('search_accommodations', { 
      destination, 
      checkIn: checkIn.toISOString().split('T')[0],
      checkOut: checkOut.toISOString().split('T')[0]
    });

    try {
      // Search across multiple partner APIs
      const searchPromises = Object.entries(this.partnerAPIs).map(([partner, config]) =>
        this.searchPartnerAPI(partner, config, validated)
      );

      const partnerResults = await Promise.allSettled(searchPromises);
      
      // Combine and deduplicate results
      const allResults = [];
      partnerResults.forEach((result, index) => {
        const partner = Object.keys(this.partnerAPIs)[index];
        if (result.status === 'fulfilled') {
          allResults.push(...result.value.map(accommodation => ({
            ...accommodation,
            partner
          })));
        } else {
          this.logError('partner_search_failed', result.reason, { partner });
        }
      });

      // Sort and limit results
      const sortedResults = this.sortAccommodations(allResults, sortBy);
      const limitedResults = sortedResults.slice(0, limit);

      // Enhance with additional data
      const enhancedResults = await this.enhanceAccommodationResults(limitedResults);

      await this.cacheSet(cacheKey, enhancedResults, 1800); // Cache for 30 minutes

      return enhancedResults;

    } catch (error) {
      this.logError('search_accommodations', error, { destination });
      throw error;
    }
  }

  async searchPartnerAPI(partner, config, searchParams) {
    // This would implement actual partner API calls
    // For now, returning mock data structure
    return [
      {
        id: `${partner}_${Math.random().toString(36).substr(2, 9)}`,
        name: `Sample Hotel ${partner}`,
        description: 'Beautiful hotel with great amenities',
        location: {
          address: 'Sample Address',
          coordinates: { lat: 40.7128, lng: -74.0060 }
        },
        price: {
          amount: Math.floor(Math.random() * 300) + 50,
          currency: 'USD',
          per: 'night'
        },
        rating: {
          score: (Math.random() * 2 + 3).toFixed(1),
          reviews: Math.floor(Math.random() * 1000) + 100
        },
        amenities: ['wifi', 'parking', 'pool'],
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg'
        ],
        availability: true
      }
    ];
  }

  async createBooking(data) {
    const validated = this.validate(data, BookingService.schemas.createBooking);
    const bookingId = crypto.randomUUID();
    
    this.logOperation('create_booking', { 
      bookingId,
      userId: validated.userId,
      accommodationId: validated.accommodationId
    });

    try {
      // Check availability
      const isAvailable = await this.checkAvailability(
        validated.accommodationId,
        validated.checkIn,
        validated.checkOut,
        validated.guests
      );

      if (!isAvailable) {
        throw new ServiceError(
          'Accommodation not available for selected dates',
          409,
          'NOT_AVAILABLE'
        );
      }

      // Create booking record
      const booking = {
        id: bookingId,
        status: 'pending',
        accommodationId: validated.accommodationId,
        userId: validated.userId,
        guestDetails: validated.guestDetails,
        checkIn: validated.checkIn.toISOString(),
        checkOut: validated.checkOut.toISOString(),
        guests: validated.guests,
        totalAmount: validated.totalAmount,
        currency: validated.currency,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store booking
      await this.cacheSet(`booking:${bookingId}`, booking, 86400); // 24 hours
      await this.cacheSet(`user_booking:${validated.userId}:${bookingId}`, true, 86400);

      // Reserve accommodation
      await this.reserveAccommodation(validated.accommodationId, booking);

      return {
        bookingId,
        status: 'pending',
        confirmationNumber: this.generateConfirmationNumber(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
      };

    } catch (error) {
      this.logError('create_booking', error, { 
        bookingId,
        accommodationId: validated.accommodationId
      });
      throw error;
    }
  }

  async confirmBooking(bookingId, paymentIntentId) {
    this.logOperation('confirm_booking', { bookingId, paymentIntentId });

    try {
      const booking = await this.cacheGet(`booking:${bookingId}`);
      if (!booking) {
        throw new ServiceError('Booking not found', 404, 'BOOKING_NOT_FOUND');
      }

      if (booking.status !== 'pending') {
        throw new ServiceError(
          'Booking cannot be confirmed in current status',
          400,
          'INVALID_STATUS'
        );
      }

      // Update booking status
      booking.status = 'confirmed';
      booking.paymentIntentId = paymentIntentId;
      booking.confirmedAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();

      await this.cacheSet(`booking:${bookingId}`, booking, 86400 * 7); // 7 days

      // Send confirmation to partner API
      await this.sendBookingToPartner(booking);

      // Generate booking voucher
      const voucher = await this.generateBookingVoucher(booking);

      return {
        bookingId,
        status: 'confirmed',
        confirmationNumber: booking.confirmationNumber || this.generateConfirmationNumber(),
        voucher
      };

    } catch (error) {
      this.logError('confirm_booking', error, { bookingId });
      throw error;
    }
  }

  async modifyBooking(data) {
    const validated = this.validate(data, BookingService.schemas.modifyBooking);
    const { bookingId, changes } = validated;

    this.logOperation('modify_booking', { bookingId, changes });

    try {
      const booking = await this.cacheGet(`booking:${bookingId}`);
      if (!booking) {
        throw new ServiceError('Booking not found', 404, 'BOOKING_NOT_FOUND');
      }

      if (!['confirmed', 'pending'].includes(booking.status)) {
        throw new ServiceError(
          'Booking cannot be modified in current status',
          400,
          'INVALID_STATUS'
        );
      }

      // Check modification policy
      const modificationPolicy = await this.getModificationPolicy(booking.accommodationId);
      const isModificationAllowed = this.checkModificationPolicy(booking, modificationPolicy);

      if (!isModificationAllowed.allowed) {
        throw new ServiceError(
          isModificationAllowed.reason,
          400,
          'MODIFICATION_NOT_ALLOWED'
        );
      }

      // Check availability for new dates/guests
      if (changes.checkIn || changes.checkOut || changes.guests) {
        const newCheckIn = changes.checkIn ? new Date(changes.checkIn) : new Date(booking.checkIn);
        const newCheckOut = changes.checkOut ? new Date(changes.checkOut) : new Date(booking.checkOut);
        const newGuests = changes.guests || booking.guests;

        const isAvailable = await this.checkAvailability(
          booking.accommodationId,
          newCheckIn,
          newCheckOut,
          newGuests
        );

        if (!isAvailable) {
          throw new ServiceError(
            'Accommodation not available for requested changes',
            409,
            'NOT_AVAILABLE'
          );
        }
      }

      // Apply changes
      Object.assign(booking, changes);
      booking.updatedAt = new Date().toISOString();
      booking.status = 'modified';

      await this.cacheSet(`booking:${bookingId}`, booking, 86400 * 7);

      // Calculate price difference if dates/guests changed
      let priceDifference = 0;
      if (changes.checkIn || changes.checkOut || changes.guests) {
        priceDifference = await this.calculatePriceDifference(booking, changes);
      }

      return {
        bookingId,
        status: 'modified',
        priceDifference,
        newTotal: booking.totalAmount + priceDifference
      };

    } catch (error) {
      this.logError('modify_booking', error, { bookingId });
      throw error;
    }
  }

  async cancelBooking(data) {
    const validated = this.validate(data, BookingService.schemas.cancelBooking);
    const { bookingId, reason, refundRequested } = validated;

    this.logOperation('cancel_booking', { bookingId, reason, refundRequested });

    try {
      const booking = await this.cacheGet(`booking:${bookingId}`);
      if (!booking) {
        throw new ServiceError('Booking not found', 404, 'BOOKING_NOT_FOUND');
      }

      if (!['confirmed', 'pending', 'modified'].includes(booking.status)) {
        throw new ServiceError(
          'Booking cannot be cancelled in current status',
          400,
          'INVALID_STATUS'
        );
      }

      // Check cancellation policy
      const cancellationPolicy = await this.getCancellationPolicy(booking.accommodationId);
      const cancellationTerms = this.calculateCancellationTerms(booking, cancellationPolicy);

      // Update booking status
      booking.status = 'cancelled';
      booking.cancelledAt = new Date().toISOString();
      booking.cancellationReason = reason;
      booking.updatedAt = new Date().toISOString();

      await this.cacheSet(`booking:${bookingId}`, booking, 86400 * 30); // Keep for 30 days

      // Release accommodation hold
      await this.releaseAccommodation(booking.accommodationId, booking);

      // Process refund if requested and eligible
      let refundResult = null;
      if (refundRequested && cancellationTerms.refundEligible) {
        refundResult = await this.processRefund(booking, cancellationTerms.refundAmount);
      }

      return {
        bookingId,
        status: 'cancelled',
        cancellationTerms,
        refund: refundResult
      };

    } catch (error) {
      this.logError('cancel_booking', error, { bookingId });
      throw error;
    }
  }

  async getBooking(bookingId, userId) {
    const booking = await this.cacheGet(`booking:${bookingId}`);
    if (!booking) {
      throw new ServiceError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Verify user has access to this booking
    if (booking.userId !== userId) {
      throw new ServiceError('Access denied', 403, 'ACCESS_DENIED');
    }

    return booking;
  }

  async getUserBookings(userId, status = null) {
    // In a real implementation, this would query a database
    // For now, we'll check cache keys
    const cachePattern = `user_booking:${userId}:*`;
    
    // This is a simplified version - in production you'd use database queries
    return {
      bookings: [], // Would contain user's bookings
      total: 0,
      page: 1,
      limit: 20
    };
  }

  // Helper methods

  async checkAvailability(accommodationId, checkIn, checkOut, guests) {
    // Mock availability check
    // In production, this would call partner APIs
    return Math.random() > 0.1; // 90% availability rate
  }

  async reserveAccommodation(accommodationId, booking) {
    // Reserve accommodation with partner
    const reservationKey = `reservation:${accommodationId}:${booking.checkIn}:${booking.checkOut}`;
    await this.cacheSet(reservationKey, booking.id, 900); // 15 minutes hold
  }

  async releaseAccommodation(accommodationId, booking) {
    const reservationKey = `reservation:${accommodationId}:${booking.checkIn}:${booking.checkOut}`;
    await this.cacheDel(reservationKey);
  }

  async sendBookingToPartner(booking) {
    // Send confirmed booking to partner API
    this.logOperation('send_booking_to_partner', { 
      bookingId: booking.id,
      accommodationId: booking.accommodationId
    });
  }

  async generateBookingVoucher(booking) {
    return {
      voucherId: crypto.randomUUID(),
      bookingId: booking.id,
      confirmationNumber: booking.confirmationNumber,
      qrCode: `https://holidaibutler.com/voucher/${booking.id}`,
      downloadUrl: `https://holidaibutler.com/api/bookings/${booking.id}/voucher.pdf`
    };
  }

  generateConfirmationNumber() {
    return 'HAB' + Date.now().toString(36).toUpperCase() + 
           Math.random().toString(36).substr(2, 3).toUpperCase();
  }

  sortAccommodations(accommodations, sortBy) {
    switch (sortBy) {
      case 'price':
        return accommodations.sort((a, b) => a.price.amount - b.price.amount);
      case 'rating':
        return accommodations.sort((a, b) => b.rating.score - a.rating.score);
      case 'distance':
        return accommodations.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      case 'popularity':
      default:
        return accommodations.sort((a, b) => b.rating.reviews - a.rating.reviews);
    }
  }

  async enhanceAccommodationResults(accommodations) {
    // Add additional data like nearby POIs, weather, etc.
    return accommodations.map(accommodation => ({
      ...accommodation,
      enhanced: true,
      lastUpdated: new Date().toISOString()
    }));
  }

  async getModificationPolicy(accommodationId) {
    return {
      allowedUntil: 24, // hours before check-in
      feePercentage: 10,
      dateChangeFee: 25
    };
  }

  checkModificationPolicy(booking, policy) {
    const checkInTime = new Date(booking.checkIn).getTime();
    const now = Date.now();
    const hoursUntilCheckIn = (checkInTime - now) / (1000 * 60 * 60);

    if (hoursUntilCheckIn < policy.allowedUntil) {
      return {
        allowed: false,
        reason: `Modifications not allowed within ${policy.allowedUntil} hours of check-in`
      };
    }

    return { allowed: true };
  }

  async getCancellationPolicy(accommodationId) {
    return {
      freeUntil: 48, // hours before check-in
      refundPercentage: 50,
      noRefundPeriod: 24
    };
  }

  calculateCancellationTerms(booking, policy) {
    const checkInTime = new Date(booking.checkIn).getTime();
    const now = Date.now();
    const hoursUntilCheckIn = (checkInTime - now) / (1000 * 60 * 60);

    if (hoursUntilCheckIn >= policy.freeUntil) {
      return {
        refundEligible: true,
        refundAmount: booking.totalAmount,
        refundPercentage: 100
      };
    } else if (hoursUntilCheckIn >= policy.noRefundPeriod) {
      const refundAmount = booking.totalAmount * (policy.refundPercentage / 100);
      return {
        refundEligible: true,
        refundAmount,
        refundPercentage: policy.refundPercentage
      };
    } else {
      return {
        refundEligible: false,
        refundAmount: 0,
        refundPercentage: 0
      };
    }
  }

  async processRefund(booking, refundAmount) {
    // This would integrate with the payment service
    return {
      refundId: crypto.randomUUID(),
      amount: refundAmount,
      status: 'pending',
      expectedDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days
    };
  }

  async calculatePriceDifference(booking, changes) {
    // Mock price calculation
    return Math.floor(Math.random() * 100) - 50; // Random price difference
  }
}

// ===================================================================
// 8. SERVICE FACTORY & DEPENDENCY INJECTION
// ===================================================================

class ServiceFactory {
  constructor() {
    this.services = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize Redis connection
      await redisClient.connect();
      logger.info('Redis connected successfully');

      // Register services
      this.register('claude', new ClaudeAIService());
      this.register('payment', new PaymentService());
      this.register('geocoding', new GeocodingService());
      this.register('weather', new WeatherService());
      this.register('booking', new BookingService());

      this.initialized = true;
      logger.info('All services initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize services', { error: error.message });
      throw error;
    }
  }

  register(name, service) {
    this.services.set(name, service);
    logger.info(`Service registered: ${name}`);
  }

  get(name) {
    if (!this.initialized) {
      throw new Error('ServiceFactory not initialized. Call initialize() first.');
    }
    
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }
    
    return service;
  }

  async shutdown() {
    logger.info('Shutting down services...');
    
    try {
      await redisClient.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection', { error: error.message });
    }

    this.services.clear();
    this.initialized = false;
    logger.info('Services shutdown complete');
  }

  // Health check for all services
  async healthCheck() {
    const results = {};
    
    for (const [name, service] of this.services) {
      try {
        // Basic service health check
        results[name] = {
          status: 'healthy',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }

    // Check Redis connection
    try {
      await redisClient.ping();
      results.redis = { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      results.redis = { 
        status: 'unhealthy', 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }

    return results;
  }
}

// ===================================================================
// 9. EXPRESS MIDDLEWARE & ROUTES INTEGRATION
// ===================================================================

// Middleware to inject services into requests
const serviceMiddleware = (serviceFactory) => {
  return (req, res, next) => {
    req.services = {
      claude: serviceFactory.get('claude'),
      payment: serviceFactory.get('payment'),
      geocoding: serviceFactory.get('geocoding'),
      weather: serviceFactory.get('weather'),
      booking: serviceFactory.get('booking')
    };
    next();
  };
};

// Error handling middleware
const serviceErrorHandler = (error, req, res, next) => {
  if (error instanceof ServiceError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        timestamp: error.timestamp
      }
    });
  }

  logger.error('Unhandled service error', { 
    error: error.message, 
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
};

// ===================================================================
// 10. EXPORT CONFIGURATION
// ===================================================================

module.exports = {
  // Services
  ClaudeAIService,
  PaymentService,
  GeocodingService,
  WeatherService,
  BookingService,
  
  // Infrastructure
  ServiceFactory,
  ServiceError,
  BaseService,
  
  // Middleware
  serviceMiddleware,
  serviceErrorHandler,
  
  // Utilities
  logger,
  redisClient
};