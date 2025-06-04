// ==========================================
// HOLIDAIBUTLER - CLAUDE AI INTEGRATION
// ==========================================

const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');
const { body, validationResult } = require('express-validator');

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ==========================================
// AI CHAT CONTROLLERS
// ==========================================

class HolidAIButlerAssistant {
  constructor() {
    this.systemPrompt = `You are HolidAIButler, an expert travel assistant specializing in vacation planning and accommodation recommendations. You help users find perfect accommodations, plan itineraries, and provide travel advice.

Key capabilities:
- Accommodation search and recommendations
- Travel itinerary planning
- Local insights and recommendations
- Booking assistance and guidance
- Budget planning advice
- Weather and seasonal travel tips
- Cultural and activity suggestions

Guidelines:
- Be warm, helpful, and enthusiastic about travel
- Ask clarifying questions to better understand preferences
- Provide specific, actionable recommendations
- Consider budget, travel dates, group size, and preferences
- Suggest alternatives when exact requests aren't available
- Use emojis sparingly but effectively
- Keep responses conversational but informative
- When suggesting accommodations, provide specific details like location, price range, and key features`;

    this.conversationMemory = new Map();
  }

  // Get user context from database
  async getUserContext(userId) {
    try {
      // Get user profile and preferences
      const userProfile = await db.query(`
        SELECT u.*, up.preferences, up.budget_range, up.favorite_destinations
        FROM users u
        LEFT JOIN user_preferences up ON u.id = up.user_id
        WHERE u.id = ?
      `, [userId]);

      // Get recent bookings for personalization
      const recentBookings = await db.query(`
        SELECT b.*, a.name, a.type, a.location, a.price_per_night
        FROM bookings b
        JOIN accommodations a ON b.accommodation_id = a.id
        WHERE b.user_id = ? AND b.status IN ('completed', 'confirmed')
        ORDER BY b.created_at DESC
        LIMIT 5
      `, [userId]);

      // Get favorite locations based on booking history
      const favoriteLocations = await db.query(`
        SELECT a.location, COUNT(*) as visit_count, AVG(r.rating) as avg_rating
        FROM bookings b
        JOIN accommodations a ON b.accommodation_id = a.id
        LEFT JOIN reviews r ON a.id = r.accommodation_id AND r.user_id = b.user_id
        WHERE b.user_id = ? AND b.status = 'completed'
        GROUP BY a.location
        ORDER BY visit_count DESC, avg_rating DESC
        LIMIT 3
      `, [userId]);

      return {
        profile: userProfile[0] || null,
        recentBookings,
        favoriteLocations
      };
    } catch (error) {
      console.error('Error getting user context:', error);
      return null;
    }
  }

  // Build context for Claude
  buildUserContextPrompt(context, message) {
    if (!context || !context.profile) {
      return message;
    }

    let contextPrompt = `User Context:
- Name: ${context.profile.name}
- Previous bookings: ${context.recentBookings.length} stays`;

    if (context.profile.preferences) {
      const prefs = JSON.parse(context.profile.preferences);
      contextPrompt += `\n- Preferences: ${Object.entries(prefs).map(([k,v]) => `${k}: ${v}`).join(', ')}`;
    }

    if (context.profile.budget_range) {
      contextPrompt += `\n- Budget range: ${context.profile.budget_range}`;
    }

    if (context.favoriteLocations.length > 0) {
      contextPrompt += `\n- Favorite locations: ${context.favoriteLocations.map(loc => loc.location).join(', ')}`;
    }

    if (context.recentBookings.length > 0) {
      contextPrompt += `\n- Recent stays: ${context.recentBookings.map(b => 
        `${b.name} (${b.type}) in ${b.location}`
      ).join(', ')}`;
    }

    return `${contextPrompt}\n\nUser message: ${message}`;
  }

  // Search accommodations based on AI interpretation
  async searchAccommodationsAI(searchParams) {
    try {
      let query = `
        SELECT a.*, AVG(r.rating) as avg_rating, COUNT(r.id) as review_count,
               ai.image_url as main_image
        FROM accommodations a
        LEFT JOIN reviews r ON a.id = r.accommodation_id
        LEFT JOIN accommodation_images ai ON a.id = ai.accommodation_id
        WHERE a.status = 'active'
      `;
      
      let conditions = [];
      let params = [];

      // Location search
      if (searchParams.location) {
        conditions.push('(a.location LIKE ? OR a.name LIKE ?)');
        params.push(`%${searchParams.location}%`, `%${searchParams.location}%`);
      }

      // Price range
      if (searchParams.priceMin) {
        conditions.push('a.price_per_night >= ?');
        params.push(searchParams.priceMin);
      }
      if (searchParams.priceMax) {
        conditions.push('a.price_per_night <= ?');
        params.push(searchParams.priceMax);
      }

      // Accommodation type
      if (searchParams.type) {
        conditions.push('a.type = ?');
        params.push(searchParams.type);
      }

      // Guests
      if (searchParams.guests) {
        conditions.push('a.max_guests >= ?');
        params.push(searchParams.guests);
      }

      // Amenities
      if (searchParams.amenities && searchParams.amenities.length > 0) {
        searchParams.amenities.forEach(amenity => {
          conditions.push('JSON_CONTAINS(a.amenities, ?)');
          params.push(`"${amenity}"`);
        });
      }

      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      query += `
        GROUP BY a.id
        ORDER BY avg_rating DESC, review_count DESC
        LIMIT 10
      `;

      return await db.query(query, params);
    } catch (error) {
      console.error('Error searching accommodations:', error);
      return [];
    }
  }

  // Parse user message for booking intent
  parseBookingIntent(message) {
    const intent = {
      isBookingRequest: false,
      location: null,
      checkIn: null,
      checkOut: null,
      guests: null,
      type: null,
      priceRange: null,
      amenities: []
    };

    // Booking keywords
    const bookingKeywords = ['book', 'reserve', 'stay', 'accommodation', 'hotel', 'room'];
    intent.isBookingRequest = bookingKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );

    // Extract location (simple regex patterns)
    const locationMatch = message.match(/(?:in|at|near)\s+([A-Za-z\s]+?)(?:\s|$|,)/i);
    if (locationMatch) {
      intent.location = locationMatch[1].trim();
    }

    // Extract guest count
    const guestMatch = message.match(/(\d+)\s*(?:guest|person|people)/i);
    if (guestMatch) {
      intent.guests = parseInt(guestMatch[1]);
    }

    // Extract accommodation type
    const types = ['hotel', 'apartment', 'villa', 'hostel', 'resort'];
    for (const type of types) {
      if (message.toLowerCase().includes(type)) {
        intent.type = type;
        break;
      }
    }

    // Extract amenities
    const amenityKeywords = {
      'pool': 'pool',
      'wifi': 'wifi',
      'parking': 'parking',
      'gym': 'gym',
      'spa': 'spa',
      'restaurant': 'restaurant',
      'balcony': 'balcony',
      'kitchen': 'kitchen'
    };

    Object.entries(amenityKeywords).forEach(([keyword, amenity]) => {
      if (message.toLowerCase().includes(keyword)) {
        intent.amenities.push(amenity);
      }
    });

    // Extract price range
    const priceMatch = message.match(/\$?(\d+)(?:\s*-\s*\$?(\d+))?/);
    if (priceMatch) {
      intent.priceRange = {
        min: parseInt(priceMatch[1]),
        max: priceMatch[2] ? parseInt(priceMatch[2]) : null
      };
    }

    return intent;
  }

  // Generate itinerary suggestions
  async generateItinerary(destination, days, interests) {
    try {
      const prompt = `Create a detailed ${days}-day travel itinerary for ${destination}. 
      User interests: ${interests.join(', ')}.
      
      Format as a day-by-day plan with:
      - Morning, afternoon, and evening activities
      - Restaurant recommendations
      - Transportation tips
      - Estimated costs
      - Local insights`;

      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return response.content[0].text;
    } catch (error) {
      console.error('Error generating itinerary:', error);
      return 'Sorry, I couldn\'t generate an itinerary at the moment. Please try again later.';
    }
  }

  // Main chat processing function
  async processMessage(userId, message, chatHistory = []) {
    try {
      // Get user context
      const userContext = await getUserContext(userId);
      
      // Build conversation history
      const conversationHistory = chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Parse user intent
      const intent = this.parseBookingIntent(message);
      
      let responseContent = '';
      let searchResults = null;
      let suggestedActions = [];

      // If booking intent detected, search accommodations
      if (intent.isBookingRequest && intent.location) {
        searchResults = await this.searchAccommodationsAI({
          location: intent.location,
          guests: intent.guests,
          type: intent.type,
          priceMin: intent.priceRange?.min,
          priceMax: intent.priceRange?.max,
          amenities: intent.amenities
        });

        if (searchResults.length > 0) {
          suggestedActions.push({
            type: 'accommodation_suggestions',
            data: searchResults.slice(0, 5)
          });
        }
      }

      // Build enhanced prompt with context
      const enhancedMessage = this.buildUserContextPrompt(userContext, message);
      
      // Add search results to context if available
      let contextualPrompt = enhancedMessage;
      if (searchResults && searchResults.length > 0) {
        contextualPrompt += `\n\nAvailable accommodations matching the request:
${searchResults.slice(0, 3).map(acc => 
  `- ${acc.name} (${acc.type}) in ${acc.location}: $${acc.price_per_night}/night, ${acc.avg_rating ? acc.avg_rating.toFixed(1) : 'No'} rating`
).join('\n')}`;
      }

      // Call Claude API
      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1500,
        system: this.systemPrompt,
        messages: [
          ...conversationHistory,
          {
            role: 'user',
            content: contextualPrompt
          }
        ]
      });

      responseContent = response.content[0].text;

      // Add suggested actions based on response analysis
      if (responseContent.toLowerCase().includes('itinerary')) {
        suggestedActions.push({
          type: 'itinerary_generation',
          data: { destination: intent.location }
        });
      }

      return {
        response: responseContent,
        intent,
        suggestedActions,
        searchResults: searchResults?.slice(0, 5) || null
      };

    } catch (error) {
      console.error('Error processing message:', error);
      return {
        response: 'I apologize, but I\'m having trouble processing your request right now. Please try again in a moment.',
        intent: null,
        suggestedActions: [],
        searchResults: null
      };
    }
  }
}

// ==========================================
// CHAT API CONTROLLERS
// ==========================================

const aiAssistant = new HolidAIButlerAssistant();

const chatController = {
  // Send message to AI assistant
  sendMessage: [
    authenticateToken,
    body('message').trim().isLength({ min: 1, max: 2000 }),
    body('conversationId').optional().isInt(),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { message, conversationId } = req.body;
        const userId = req.user.userId;

        // Get or create conversation
        let conversation;
        if (conversationId) {
          const conversations = await db.query(
            'SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?',
            [conversationId, userId]
          );
          conversation = conversations[0];
        }

        if (!conversation) {
          // Create new conversation
          const result = await db.query(`
            INSERT INTO chat_conversations (user_id, title, created_at, updated_at)
            VALUES (?, ?, NOW(), NOW())
          `, [userId, message.substring(0, 50) + '...']);
          
          conversation = { id: result.insertId };
        }

        // Get chat history
        const chatHistory = await db.query(`
          SELECT role, content FROM chat_messages 
          WHERE conversation_id = ? 
          ORDER BY created_at ASC 
          LIMIT 20
        `, [conversation.id]);

        // Save user message
        await db.query(`
          INSERT INTO chat_messages (conversation_id, role, content, created_at)
          VALUES (?, 'user', ?, NOW())
        `, [conversation.id, message]);

        // Process message with AI
        const aiResponse = await aiAssistant.processMessage(userId, message, chatHistory);

        // Save AI response
        await db.query(`
          INSERT INTO chat_messages (conversation_id, role, content, metadata, created_at)
          VALUES (?, 'assistant', ?, ?, NOW())
        `, [conversation.id, aiResponse.response, JSON.stringify({
          intent: aiResponse.intent,
          suggestedActions: aiResponse.suggestedActions,
          searchResults: aiResponse.searchResults
        })]);

        // Update conversation timestamp
        await db.query(
          'UPDATE chat_conversations SET updated_at = NOW() WHERE id = ?',
          [conversation.id]
        );

        res.json({
          conversationId: conversation.id,
          response: aiResponse.response,
          intent: aiResponse.intent,
          suggestedActions: aiResponse.suggestedActions,
          searchResults: aiResponse.searchResults
        });

      } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process message' });
      }
    }
  ],

  // Get user conversations
  getConversations: [
    authenticateToken,
    query('page').optional().isInt({ min: 0 }),
    query('size').optional().isInt({ min: 1, max: 50 }),
    async (req, res) => {
      try {
        const { page = 0, size = 20 } = req.query;
        const { limit, offset } = getPagination(page, size);

        const conversations = await db.query(`
          SELECT c.*, 
                 (SELECT content FROM chat_messages 
                  WHERE conversation_id = c.id 
                  ORDER BY created_at DESC LIMIT 1) as last_message,
                 (SELECT created_at FROM chat_messages 
                  WHERE conversation_id = c.id 
                  ORDER BY created_at DESC LIMIT 1) as last_message_at
          FROM chat_conversations c
          WHERE c.user_id = ?
          ORDER BY c.updated_at DESC
          LIMIT ? OFFSET ?
        `, [req.user.userId, limit, offset]);

        res.json(conversations);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch conversations' });
      }
    }
  ],

  // Get conversation messages
  getMessages: [
    authenticateToken,
    async (req, res) => {
      try {
        const { conversationId } = req.params;

        // Verify conversation ownership
        const conversations = await db.query(
          'SELECT id FROM chat_conversations WHERE id = ? AND user_id = ?',
          [conversationId, req.user.userId]
        );

        if (conversations.length === 0) {
          return res.status(404).json({ error: 'Conversation not found' });
        }

        const messages = await db.query(`
          SELECT role, content, metadata, created_at
          FROM chat_messages
          WHERE conversation_id = ?
          ORDER BY created_at ASC
        `, [conversationId]);

        res.json(messages);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
      }
    }
  ],

  // Generate travel itinerary
  generateItinerary: [
    authenticateToken,
    body('destination').trim().isLength({ min: 2 }),
    body('days').isInt({ min: 1, max: 30 }),
    body('interests').isArray(),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { destination, days, interests } = req.body;
        
        const itinerary = await aiAssistant.generateItinerary(destination, days, interests);
        
        res.json({ itinerary });
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate itinerary' });
      }
    }
  ],

  // Get smart recommendations
  getRecommendations: [
    authenticateToken,
    async (req, res) => {
      try {
        const userId = req.user.userId;
        const userContext = await aiAssistant.getUserContext(userId);

        // Generate personalized recommendations based on user history
        let recommendations = [];

        if (userContext && userContext.favoriteLocations.length > 0) {
          // Recommend similar accommodations in favorite locations
          const favoriteLocation = userContext.favoriteLocations[0].location;
          
          const similarAccommodations = await db.query(`
            SELECT a.*, AVG(r.rating) as avg_rating, ai.image_url
            FROM accommodations a
            LEFT JOIN reviews r ON a.id = r.accommodation_id
            LEFT JOIN accommodation_images ai ON a.id = ai.accommodation_id
            WHERE a.location LIKE ? AND a.status = 'active'
            GROUP BY a.id
            ORDER BY avg_rating DESC
            LIMIT 5
          `, [`%${favoriteLocation}%`]);

          recommendations.push({
            type: 'similar_destinations',
            title: `More places in ${favoriteLocation}`,
            items: similarAccommodations
          });
        }

        // Trending destinations
        const trending = await db.query(`
          SELECT a.location, COUNT(*) as booking_count, AVG(r.rating) as avg_rating,
                 MIN(a.price_per_night) as min_price
          FROM bookings b
          JOIN accommodations a ON b.accommodation_id = a.id
          LEFT JOIN reviews r ON a.id = r.accommodation_id
          WHERE b.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY a.location
          ORDER BY booking_count DESC
          LIMIT 5
        `);

        recommendations.push({
          type: 'trending_destinations',
          title: 'Trending Destinations',
          items: trending
        });

        res.json(recommendations);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get recommendations' });
      }
    }
  ],

  // Update user preferences based on chat interactions
  updatePreferences: [
    authenticateToken,
    body('preferences').isObject(),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { preferences } = req.body;
        const userId = req.user.userId;

        await db.query(`
          INSERT INTO user_preferences (user_id, preferences, updated_at)
          VALUES (?, ?, NOW())
          ON DUPLICATE KEY UPDATE 
          preferences = ?, updated_at = NOW()
        `, [userId, JSON.stringify(preferences), JSON.stringify(preferences)]);

        res.json({ message: 'Preferences updated successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update preferences' });
      }
    }
  ]
};

// ==========================================
// WEBSOCKET CHAT INTEGRATION
// ==========================================

const socketio = require('socket.io');

function initializeChatSocket(server) {
  const io = socketio(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  // Authentication middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected to chat`);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    // Handle chat messages
    socket.on('send_message', async (data) => {
      try {
        const { message, conversationId } = data;
        
        // Process with AI assistant
        const chatHistory = conversationId ? await db.query(`
          SELECT role, content FROM chat_messages 
          WHERE conversation_id = ? 
          ORDER BY created_at ASC 
          LIMIT 20
        `, [conversationId]) : [];

        const aiResponse = await aiAssistant.processMessage(
          socket.userId, 
          message, 
          chatHistory
        );

        // Emit response back to user
        socket.emit('message_response', {
          response: aiResponse.response,
          intent: aiResponse.intent,
          suggestedActions: aiResponse.suggestedActions,
          searchResults: aiResponse.searchResults,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Socket message error:', error);
        socket.emit('error', { message: 'Failed to process message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', () => {
      socket.to(`user_${socket.userId}`).emit('user_typing', socket.userId);
    });

    socket.on('typing_stop', () => {
      socket.to(`user_${socket.userId}`).emit('user_stopped_typing', socket.userId);
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected from chat`);
    });
  });

  return io;
}

// ==========================================
// ROUTES SETUP
// ==========================================

const chatRouter = express.Router();

// Chat API routes
chatRouter.post('/chat/message', chatController.sendMessage);
chatRouter.get('/chat/conversations', chatController.getConversations);
chatRouter.get('/chat/conversations/:conversationId/messages', chatController.getMessages);
chatRouter.post('/chat/itinerary', chatController.generateItinerary);
chatRouter.get('/chat/recommendations', chatController.getRecommendations);
chatRouter.put('/chat/preferences', chatController.updatePreferences);

// ==========================================
// DATABASE MIGRATIONS FOR CHAT
// ==========================================

const chatMigrations = `
-- Chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_updated (user_id, updated_at)
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content TEXT NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  INDEX idx_conversation_created (conversation_id, created_at)
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNIQUE NOT NULL,
  preferences JSON,
  budget_range VARCHAR(50),
  favorite_destinations TEXT,
  travel_style ENUM('budget', 'mid-range', 'luxury', 'adventure', 'relaxation'),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AI interaction analytics
CREATE TABLE IF NOT EXISTS ai_interactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  conversation_id INT,
  message_type ENUM('booking_inquiry', 'recommendation_request', 'itinerary_planning', 'general_chat'),
  intent_data JSON,
  response_satisfaction TINYINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE SET NULL,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_message_type (message_type)
);
`;

module.exports = {
  chatRouter,
  chatController,
  HolidAIButlerAssistant,
  initializeChatSocket,
  chatMigrations
};