// =====================================
// USER MODEL - Complete user management
// =====================================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  // Basic Information
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens']
  },
  password: {
    type: String,
    required: function() { return !this.socialAuth.google.id && !this.socialAuth.apple.id; },
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include in queries by default
  },
  
  // Profile Information
  profile: {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    avatar: {
      type: String, // URL to avatar image
      default: null
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function(date) {
          return date < new Date();
        },
        message: 'Date of birth must be in the past'
      }
    },
    phoneNumber: {
      type: String,
      match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters']
    }
  },

  // Travel Preferences
  preferences: {
    travelStyle: {
      type: String,
      enum: ['budget', 'mid-range', 'luxury', 'adventure', 'cultural', 'relaxation'],
      default: 'mid-range'
    },
    preferredLanguages: [{
      type: String,
      enum: ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt', 'zh', 'ja', 'ko']
    }],
    dietaryRestrictions: [{
      type: String,
      enum: ['vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher', 'none']
    }],
    mobility: {
      type: String,
      enum: ['full', 'limited', 'wheelchair'],
      default: 'full'
    },
    budgetRange: {
      daily: {
        min: { type: Number, min: 0 },
        max: { type: Number, min: 0 }
      },
      currency: {
        type: String,
        enum: ['EUR', 'USD', 'GBP', 'JPY', 'CNY'],
        default: 'EUR'
      }
    },
    favoriteActivities: [{
      type: String,
      enum: ['museums', 'restaurants', 'nightlife', 'nature', 'shopping', 'sports', 'art', 'history', 'music', 'food', 'adventure']
    }],
    avoidActivities: [{
      type: String,
      enum: ['museums', 'restaurants', 'nightlife', 'nature', 'shopping', 'sports', 'art', 'history', 'music', 'food', 'adventure']
    }]
  },

  // Social Authentication
  socialAuth: {
    google: {
      id: String,
      email: String,
      verified: { type: Boolean, default: false }
    },
    apple: {
      id: String,
      email: String,
      verified: { type: Boolean, default: false }
    }
  },

  // Account Status
  status: {
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    lastLogin: Date,
    loginCount: { type: Number, default: 0 }
  },

  // Security
  security: {
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    twoFactorSecret: String,
    twoFactorEnabled: { type: Boolean, default: false },
    lastPasswordChange: { type: Date, default: Date.now }
  },

  // Location & Privacy
  location: {
    current: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: '2dsphere'
      },
      city: String,
      country: String,
      lastUpdated: { type: Date, default: Date.now }
    },
    shareLocation: { type: Boolean, default: false }
  },

  // App Settings
  settings: {
    notifications: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      marketing: { type: Boolean, default: false }
    },
    privacy: {
      profileVisible: { type: Boolean, default: true },
      shareData: { type: Boolean, default: false }
    },
    app: {
      theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
      language: { type: String, default: 'en' },
      units: { type: String, enum: ['metric', 'imperial'], default: 'metric' }
    }
  },

  // Analytics & Personalization
  analytics: {
    totalConversations: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    favoriteCategories: [String],
    searchHistory: [{
      query: String,
      timestamp: { type: Date, default: Date.now },
      location: String
    }],
    lastActivity: { type: Date, default: Date.now }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'location.current': '2dsphere' });
userSchema.index({ 'analytics.lastActivity': -1 });
userSchema.index({ 'status.isActive': 1, 'status.isBanned': 1 });

// Virtual for full name
userSchema.virtual('profile.fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Virtual for age
userSchema.virtual('profile.age').get(function() {
  if (!this.profile.dateOfBirth) return null;
  return Math.floor((Date.now() - this.profile.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (!this.isModified('password')) return next();
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Instance methods
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.security.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.security.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

const User = mongoose.model('User', userSchema);

// =====================================
// POI MODEL - Points of Interest
// =====================================

const poiSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'POI name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [300, 'Short description cannot exceed 300 characters']
  },

  // Location Data
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Coordinates are required'],
      index: '2dsphere'
    },
    address: {
      street: String,
      city: { type: String, required: true },
      state: String,
      country: { type: String, required: true },
      postalCode: String,
      formatted: String
    },
    neighborhood: String
  },

  // Classification
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'restaurant', 'attraction', 'hotel', 'museum', 'park', 'shopping',
      'nightlife', 'entertainment', 'transport', 'service', 'activity',
      'cultural', 'historical', 'nature', 'adventure', 'wellness'
    ]
  },
  subcategory: {
    type: String,
    maxlength: [100, 'Subcategory cannot exceed 100 characters']
  },
  tags: [{
    type: String,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],

  // Business Information
  business: {
    website: {
      type: String,
      match: [/^https?:\/\/.+/, 'Website must be a valid URL']
    },
    phone: String,
    email: {
      type: String,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    hours: {
      monday: { open: String, close: String, closed: { type: Boolean, default: false } },
      tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
      wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
      thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
      friday: { open: String, close: String, closed: { type: Boolean, default: false } },
      saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
      sunday: { open: String, close: String, closed: { type: Boolean, default: false } }
    },
    priceRange: {
      type: String,
      enum: ['$', '$$', '$$$', '$$$$'],
      default: '$$'
    },
    acceptsReservations: { type: Boolean, default: false },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner'
    }
  },

  // Media
  media: {
    images: [{
      url: { type: String, required: true },
      caption: String,
      isPrimary: { type: Boolean, default: false },
      order: { type: Number, default: 0 }
    }],
    videos: [{
      url: String,
      caption: String,
      thumbnail: String
    }]
  },

  // Ratings & Reviews
  ratings: {
    average: { type: Number, min: 0, max: 5, default: 0 },
    count: { type: Number, default: 0 },
    distribution: {
      5: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      1: { type: Number, default: 0 }
    }
  },

  // Accessibility
  accessibility: {
    wheelchairAccessible: { type: Boolean, default: false },
    hasParking: { type: Boolean, default: false },
    hasWifi: { type: Boolean, default: false },
    petFriendly: { type: Boolean, default: false },
    familyFriendly: { type: Boolean, default: true },
    features: [String] // Array of accessibility features
  },

  // AI Enhancement Data
  aiData: {
    sentiment: {
      positive: { type: Number, default: 0 },
      neutral: { type: Number, default: 0 },
      negative: { type: Number, default: 0 }
    },
    popularTimes: [{
      day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
      hours: [{ hour: Number, popularity: Number }] // 0-23 hours, 0-100 popularity
    }],
    seasonality: {
      spring: { type: Number, min: 0, max: 100 },
      summer: { type: Number, min: 0, max: 100 },
      fall: { type: Number, min: 0, max: 100 },
      winter: { type: Number, min: 0, max: 100 }
    },
    recommendationScore: { type: Number, default: 50, min: 0, max: 100 },
    lastAiUpdate: { type: Date, default: Date.now }
  },

  // Status & Metadata
  status: {
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    lastVerified: Date,
    dataSource: {
      type: String,
      enum: ['manual', 'google', 'foursquare', 'partner', 'user'],
      default: 'manual'
    },
    externalIds: {
      google: String,
      foursquare: String,
      tripadvisor: String
    }
  },

  // Analytics
  analytics: {
    viewCount: { type: Number, default: 0 },
    bookingCount: { type: Number, default: 0 },
    favoriteCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    lastViewed: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
poiSchema.index({ location: '2dsphere' });
poiSchema.index({ category: 1, 'status.isActive': 1 });
poiSchema.index({ 'ratings.average': -1 });
poiSchema.index({ 'aiData.recommendationScore': -1 });
poiSchema.index({ 'location.address.city': 1, 'location.address.country': 1 });
poiSchema.index({ tags: 1 });

// Virtual for primary image
poiSchema.virtual('primaryImage').get(function() {
  const primaryImg = this.media.images.find(img => img.isPrimary);
  return primaryImg ? primaryImg.url : (this.media.images[0] ? this.media.images[0].url : null);
});

const POI = mongoose.model('POI', poiSchema);

// =====================================
// CONVERSATION MODEL - Chat History
// =====================================

const conversationSchema = new mongoose.Schema({
  // Participants
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  
  // Conversation Metadata
  title: {
    type: String,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    default: 'New Conversation'
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },

  // Messages
  messages: [{
    messageId: {
      type: String,
      required: true,
      default: () => crypto.randomUUID()
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      maxlength: [10000, 'Message cannot exceed 10000 characters']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    
    // Message Metadata
    metadata: {
      type: {
        type: String,
        enum: ['text', 'voice', 'image', 'location', 'poi_recommendation', 'booking_request'],
        default: 'text'
      },
      voiceData: {
        audioUrl: String,
        duration: Number, // seconds
        transcript: String,
        language: String
      },
      imageData: {
        imageUrl: String,
        caption: String,
        analysis: String
      },
      locationData: {
        coordinates: [Number], // [longitude, latitude]
        address: String,
        accuracy: Number
      },
      poiData: [{
        poiId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'POI'
        },
        reason: String,
        confidence: { type: Number, min: 0, max: 1 }
      }],
      bookingData: {
        poiId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'POI'
        },
        date: Date,
        time: String,
        partySize: Number,
        specialRequests: String
      }
    },

    // AI Processing
    aiProcessing: {
      intent: String,
      entities: [{
        type: String,
        value: String,
        confidence: Number
      }],
      sentiment: {
        type: String,
        enum: ['positive', 'neutral', 'negative'],
        default: 'neutral'
      },
      confidence: { type: Number, min: 0, max: 1 },
      processingTime: Number, // milliseconds
      model: String // AI model used
    },

    // Status
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed'],
      default: 'sent'
    },
    isEdited: { type: Boolean, default: false },
    editHistory: [{
      content: String,
      editedAt: { type: Date, default: Date.now }
    }]
  }],

  // Conversation Context
  context: {
    currentLocation: {
      coordinates: [Number], // [longitude, latitude]
      city: String,
      country: String
    },
    travelDates: {
      start: Date,
      end: Date
    },
    partySize: { type: Number, min: 1, default: 1 },
    budget: {
      amount: Number,
      currency: String
    },
    preferences: {
      categories: [String],
      avoidCategories: [String],
      dietary: [String],
      accessibility: [String]
    },
    language: { type: String, default: 'en' }
  },

  // Conversation State
  state: {
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'archived'],
      default: 'active'
    },
    lastActivity: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    stage: {
      type: String,
      enum: ['greeting', 'planning', 'exploring', 'booking', 'completed'],
      default: 'greeting'
    }
  },

  // Analytics
  analytics: {
    messageCount: { type: Number, default: 0 },
    userMessageCount: { type: Number, default: 0 },
    assistantMessageCount: { type: Number, default: 0 },
    averageResponseTime: Number, // milliseconds
    totalDuration: Number, // seconds
    recommendationsGiven: { type: Number, default: 0 },
    bookingsInitiated: { type: Number, default: 0 },
    satisfaction: {
      rating: { type: Number, min: 1, max: 5 },
      feedback: String,
      timestamp: Date
    }
  },

  // Privacy & Retention
  privacy: {
    isArchived: { type: Boolean, default: false },
    deleteAt: Date, // Auto-deletion date
    dataRetention: {
      type: String,
      enum: ['standard', 'extended', 'minimal'],
      default: 'standard'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
conversationSchema.index({ userId: 1, 'state.lastActivity': -1 });
conversationSchema.index({ sessionId: 1 });
conversationSchema.index({ 'state.status': 1, 'state.isActive': 1 });
conversationSchema.index({ 'messages.timestamp': -1 });
conversationSchema.index({ 'privacy.deleteAt': 1 }, { expireAfterSeconds: 0 });

// Virtual for last message
conversationSchema.virtual('lastMessage').get(function() {
  return this.messages[this.messages.length - 1];
});

// Pre-save middleware to update analytics
conversationSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    this.analytics.messageCount = this.messages.length;
    this.analytics.userMessageCount = this.messages.filter(m => m.role === 'user').length;
    this.analytics.assistantMessageCount = this.messages.filter(m => m.role === 'assistant').length;
    this.state.lastActivity = new Date();
  }
  next();
});

const Conversation = mongoose.model('Conversation', conversationSchema);

// =====================================
// BOOKING MODEL - Reservation System
// =====================================

const bookingSchema = new mongoose.Schema({
  // References
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  poiId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POI',
    required: [true, 'POI ID is required']
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },

  // Booking Details
  bookingNumber: {
    type: String,
    unique: true,
    required: true,
    default: () => 'HB' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase()
  },
  
  // Reservation Information
  reservation: {
    date: {
      type: Date,
      required: [true, 'Reservation date is required']
    },
    time: {
      type: String,
      required: [true, 'Reservation time is required'],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format']
    },
    duration: {
      type: Number, // minutes
      default: 120
    },
    partySize: {
      type: Number,
      required: [true, 'Party size is required'],
      min: [1, 'Party size must be at least 1'],
      max: [20, 'Party size cannot exceed 20']
    },
    specialRequests: {
      type: String,
      maxlength: [1000, 'Special requests cannot exceed 1000 characters']
    }
  },

  // Contact Information
  contact: {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
    }
  },

  // Pricing
  pricing: {
    basePrice: {
      type: Number,
      required: true,
      min: 0
    },
    taxes: {
      type: Number,
      default: 0,
      min: 0
    },
    fees: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      amount: { type: Number, default: 0, min: 0 },
      code: String,
      reason: String
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      enum: ['EUR', 'USD', 'GBP', 'JPY', 'CNY'],
      default: 'EUR'
    }
  },

  // Payment
  payment: {
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partial_refund'],
      default: 'pending'
    },
    method: {
      type: String,
      enum: ['card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer'],
      required: true
    },
    transactionId: String,
    stripePaymentIntentId: String,
    paidAt: Date,
    refundedAt: Date,
    refundAmount: Number,
    refundReason: String
  },

  // Booking Status
  status: {
    current: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
      default: 'pending'
    },
    history: [{
      status: String,
      timestamp: { type: Date, default: Date.now },
      reason: String,
      updatedBy: String // user, system, partner
    }],
    confirmationCode: {
      type: String,
      default: () => Math.random().toString(36).substr(2, 8).toUpperCase()
    },
    confirmedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    completedAt: Date
  },

  // Communication
  communications: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'push', 'system'],
      required: true
    },
    subject: String,
    message: {
      type: String,
      required: true
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed'],
      default: 'sent'
    },
    templateId: String
  }],

  // Partner Information
  partner: {
    confirmed: { type: Boolean, default: false },
    confirmationDetails: String,
    partnerBookingId: String,
    notes: String
  },

  // Review & Rating
  review: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
    reviewedAt: Date,
    helpful: { type: Number, default: 0 },
    reported: { type: Boolean, default: false }
  },

  // Metadata
  metadata: {
    source: {
      type: String,
      enum: ['mobile_app', 'web', 'partner_api', 'admin'],
      default: 'mobile_app'
    },
    userAgent: String,
    ipAddress: String,
    createdBy: {
      type: String,
      enum: ['user', 'admin', 'system'],
      default: 'user'
    },
    notes: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
bookingSchema.index({ userId: 1, 'reservation.date': -1 });
bookingSchema.index({ poiId: 1, 'reservation.date': 1 });
bookingSchema.index({ bookingNumber: 1 });
bookingSchema.index({ 'status.current': 1, 'reservation.date': 1 });
bookingSchema.index({ 'payment.status': 1 });
bookingSchema.index({ 'status.confirmationCode': 1 });

// Virtual for booking confirmation
bookingSchema.virtual('isConfirmed').get(function() {
  return this.status.current === 'confirmed';
});

// Virtual for full contact name
bookingSchema.virtual('contact.fullName').get(function() {
  return `${this.contact.firstName} ${this.contact.lastName}`;
});

// Pre-save middleware
bookingSchema.pre('save', function(next) {
  // Update status history if status changed
  if (this.isModified('status.current')) {
    this.status.history.push({
      status: this.status.current,
      timestamp: new Date(),
      updatedBy: 'system'
    });
  }

  // Set confirmation date
  if (this.status.current === 'confirmed' && !this.status.confirmedAt) {
    this.status.confirmedAt = new Date();
  }

  // Set cancellation date
  if (this.status.current === 'cancelled' && !this.status.cancelledAt) {
    this.status.cancelledAt = new Date();
  }

  // Set completion date
  if (this.status.current === 'completed' && !this.status.completedAt) {
    this.status.completedAt = new Date();
  }

  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

// =====================================
// PARTNER MODEL - Business Partners
// =====================================

const partnerSchema = new mongoose.Schema({
  // Basic Information
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
    maxlength: [200, 'Business name cannot exceed 200 characters']
  },
  tradingName: {
    type: String,
    trim: true,
    maxlength: [200, 'Trading name cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },

  // Contact Information
  contact: {
    primaryEmail: {
      type: String,
      required: [true, 'Primary email is required'],
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    billingEmail: {
      type: String,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required']
    },
    website: {
      type: String,
      match: [/^https?:\/\/.+/, 'Website must be a valid URL']
    },
    socialMedia: {
      facebook: String,
      instagram: String,
      twitter: String,
      linkedin: String
    }
  },

  // Business Address
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: String,
    country: {
      type: String,
      required: [true, 'Country is required']
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required']
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },

  // Business Details
  business: {
    type: {
      type: String,
      enum: ['restaurant', 'hotel', 'attraction', 'tour_operator', 'transportation', 'retail', 'service'],
      required: [true, 'Business type is required']
    },
    category: String,
    subcategory: String,
    establishedYear: {
      type: Number,
      min: 1800,
      max: new Date().getFullYear()
    },
    employeeCount: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '500+']
    },
    registrationNumber: String,
    taxId: String,
    licenses: [String]
  },

  // Partnership Details
  partnership: {
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'terminated'],
      default: 'pending'
    },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze'
    },
    startDate: Date,
    renewalDate: Date,
    contractUrl: String,
    commissionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 15 // percentage
    },
    minimumNotice: {
      type: Number,
      default: 24 // hours
    },
    autoConfirm: {
      type: Boolean,
      default: false
    }
  },

  // API Integration
  integration: {
    hasApi: { type: Boolean, default: false },
    apiKey: String,
    webhookUrl: String,
    endpoints: {
      bookings: String,
      availability: String,
      cancellation: String
    },
    authentication: {
      type: { type: String, enum: ['api_key', 'oauth', 'basic_auth'] },
      credentials: mongoose.Schema.Types.Mixed
    },
    lastSync: Date,
    syncErrors: [{
      error: String,
      timestamp: { type: Date, default: Date.now },
      resolved: { type: Boolean, default: false }
    }]
  },

  // Financial Information
  financial: {
    bankAccount: {
      accountName: String,
      accountNumber: String,
      routingNumber: String,
      iban: String,
      swift: String
    },
    billingInfo: {
      companyName: String,
      address: String,
      taxId: String,
      currency: {
        type: String,
        enum: ['EUR', 'USD', 'GBP', 'JPY', 'CNY'],
        default: 'EUR'
      }
    },
    paymentTerms: {
      type: String,
      enum: ['immediate', 'weekly', 'bi-weekly', 'monthly'],
      default: 'monthly'
    },
    minimumPayout: {
      type: Number,
      default: 50
    }
  },

  // Performance Metrics
  metrics: {
    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    confirmationRate: { type: Number, default: 0, min: 0, max: 100 },
    cancellationRate: { type: Number, default: 0, min: 0, max: 100 },
    responseTime: { type: Number, default: 0 }, // average minutes
    lastActivity: Date
  },

  // Points of Interest
  pois: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'POI'
  }],

  // Team Members
  team: [{
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    role: {
      type: String,
      enum: ['owner', 'manager', 'staff', 'admin'],
      required: true
    },
    permissions: [{
      type: String,
      enum: ['view_bookings', 'manage_bookings', 'view_analytics', 'manage_profile', 'manage_team']
    }],
    isActive: { type: Boolean, default: true },
    addedAt: { type: Date, default: Date.now }
  }],

  // Verification & Compliance
  verification: {
    isVerified: { type: Boolean, default: false },
    verifiedAt: Date,
    verifiedBy: String,
    documents: [{
      type: { type: String, enum: ['business_license', 'insurance', 'tax_cert', 'id_proof'] },
      url: String,
      uploadedAt: { type: Date, default: Date.now },
      verified: { type: Boolean, default: false }
    }],
    compliance: {
      gdpr: { type: Boolean, default: false },
      dataProcessing: { type: Boolean, default: false },
      termsAccepted: { type: Boolean, default: false },
      termsAcceptedAt: Date
    }
  },

  // Settings
  settings: {
    notifications: {
      newBooking: { type: Boolean, default: true },
      cancellation: { type: Boolean, default: true },
      payment: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    },
    availability: {
      autoBlock: { type: Boolean, default: false },
      leadTime: { type: Number, default: 2 }, // hours
      maxAdvanceBooking: { type: Number, default: 90 } // days
    },
    policies: {
      cancellationPolicy: String,
      refundPolicy: String,
      childPolicy: String,
      petPolicy: String
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
partnerSchema.index({ 'contact.primaryEmail': 1 });
partnerSchema.index({ 'partnership.status': 1 });
partnerSchema.index({ 'business.type': 1, 'partnership.status': 1 });
partnerSchema.index({ 'address.coordinates': '2dsphere' });
partnerSchema.index({ 'metrics.averageRating': -1 });

// Virtual for active POIs count
partnerSchema.virtual('activePoisCount').get(function() {
  return this.pois ? this.pois.length : 0;
});

const Partner = mongoose.model('Partner', partnerSchema);

// =====================================
// EXPORT ALL MODELS
// =====================================

module.exports = {
  User,
  POI,
  Conversation,
  Booking,
  Partner
};