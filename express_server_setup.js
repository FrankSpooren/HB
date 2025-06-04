// ==========================================
// SERVER.JS - Main Application Entry Point
// ==========================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const redis = require('redis');
const passport = require('passport');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger.json');

// Import configurations
const { connectDB } = require('./src/utils/database');
const { connectRedis } = require('./src/utils/redis');
const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/errorHandler');
const { notFound } = require('./src/middleware/errorHandler');

// Import routes
const authRoutes = require('./src/routes/auth');
const chatRoutes = require('./src/routes/chat');
const poiRoutes = require('./src/routes/pois');
const userRoutes = require('./src/routes/users');
const bookingRoutes = require('./src/routes/bookings');

// Import passport configuration
require('./src/config/passport');

// Load environment variables
require('dotenv').config();

// Create Express application
const app = express();

// ==========================================
// DATABASE CONNECTIONS
// ==========================================

// Connect to MongoDB
connectDB();

// Connect to Redis
const redisClient = connectRedis();

// ==========================================
// MIDDLEWARE SETUP
// ==========================================

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:19000',  // Expo dev
      'http://localhost:19001',  // Expo web
      'http://localhost:3000',   // Local frontend
      'https://holidaibutler.com',
      'https://api.holidaibutler.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Data sanitization middleware
app.use(mongoSanitize()); // Against NoSQL injection
app.use(xss()); // Against XSS attacks
app.use(hpp()); // Prevent parameter pollution

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests, please try again later',
    retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW) || 15)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Session configuration
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  name: 'holidaibutler.sid'
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// ==========================================
// API DOCUMENTATION
// ==========================================

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'HolidAIButler API Documentation'
}));

// ==========================================
// HEALTH CHECK ENDPOINTS
// ==========================================

app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
    
    // Check Redis connection
    const redisStatus = redisClient.connected ? 'connected' : 'disconnected';
    
    const healthCheck = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION || '1.0.0',
      services: {
        database: {
          status: dbStatus,
          type: 'MongoDB'
        },
        cache: {
          status: redisStatus,
          type: 'Redis'
        }
      }
    };

    res.status(200).json(healthCheck);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    // Detailed API health check
    const dbState = mongoose.connection.readyState;
    const memoryUsage = process.memoryUsage();
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV,
      database: {
        status: dbState === 1 ? 'connected' : 'disconnected',
        readyState: dbState
      },
      redis: {
        status: redisClient.connected ? 'connected' : 'disconnected'
      },
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB'
      }
    };

    res.status(200).json(healthData);
  } catch (error) {
    logger.error('API health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==========================================
// API ROUTES
// ==========================================

// API root
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to HolidAIButler API',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    documentation: '/api-docs',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      chat: '/api/chat',
      pois: '/api/pois',
      users: '/api/users',
      bookings: '/api/bookings'
    }
  });
});

// Route mounting
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/pois', poiRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// ==========================================
// ERROR HANDLING MIDDLEWARE
// ==========================================

// 404 handler for undefined routes
app.use('*', notFound);

// Global error handler
app.use(errorHandler);

// ==========================================
// SERVER STARTUP
// ==========================================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

const server = app.listen(PORT, HOST, () => {
  logger.info(`🚀 HolidAIButler API server running on ${HOST}:${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
  logger.info(`📚 API Documentation: http://${HOST}:${PORT}/api-docs`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      redisClient.quit(() => {
        logger.info('Redis connection closed');
        process.exit(0);
      });
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;

// ==========================================
// DATABASE CONNECTION UTILITY
// src/utils/database.js
// ==========================================

const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 10,
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 5,
      maxIdleTimeMS: parseInt(process.env.MONGO_MAX_IDLE_TIME) || 30000,
      serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT) || 5000,
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { connectDB };

// ==========================================
// REDIS CONNECTION UTILITY
// src/utils/redis.js
// ==========================================

const redis = require('redis');
const logger = require('./logger');

const connectRedis = () => {
  try {
    const client = redis.createClient({
      url: process.env.REDIS_URL,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server connection refused');
          return new Error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis max retry attempts reached');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    client.on('connect', () => {
      logger.info('✅ Redis client connected');
    });

    client.on('ready', () => {
      logger.info('✅ Redis client ready');
    });

    client.on('error', (err) => {
      logger.error('❌ Redis client error:', err);
    });

    client.on('end', () => {
      logger.info('Redis client connection ended');
    });

    client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    return client;
  } catch (error) {
    logger.error('❌ Redis connection failed:', error.message);
    throw error;
  }
};

module.exports = { connectRedis };

// ==========================================
// WINSTON LOGGER CONFIGURATION
// src/utils/logger.js
// ==========================================

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = 'logs';
const fs = require('fs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'holidaibutler-api' },
  transports: [
    // Error log file
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '10m',
      maxFiles: '14d',
      zippedArchive: true
    }),

    // Combined log file
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '7d',
      zippedArchive: true
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

module.exports = logger;

// ==========================================
// ERROR HANDLER MIDDLEWARE
// src/middleware/errorHandler.js
// ==========================================

const logger = require('../utils/logger');

// Custom Error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle CastError (Invalid MongoDB ObjectId)
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// Handle Duplicate Fields Error
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(?:(?=(\\?))\2.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

// Handle Validation Error
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Handle JWT Error
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

// Handle JWT Expired Error
const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

// Send error response for development
const sendErrorDev = (err, req, res) => {
  logger.error('API Error:', err);

  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

// Send error response for production
const sendErrorProd = (err, req, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('Programming Error:', err);

    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!'
    });
  }
};

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};

// 404 Not Found handler
const notFound = (req, res, next) => {
  const err = new AppError(`Can't find ${req.originalUrl} on this server!`, 404);
  next(err);
};

module.exports = { errorHandler, notFound, AppError };

// ==========================================
// BASIC ROUTE STRUCTURES
// ==========================================

// src/routes/auth.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Auth routes - Coming soon!' });
});

module.exports = router;

// src/routes/chat.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Chat routes - Coming soon!' });
});

module.exports = router;

// src/routes/pois.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'POI routes - Coming soon!' });
});

module.exports = router;

// src/routes/users.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'User routes - Coming soon!' });
});

module.exports = router;

// src/routes/bookings.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Booking routes - Coming soon!' });
});

module.exports = router;

// ==========================================
// PASSPORT CONFIGURATION PLACEHOLDER
// src/config/passport.js
// ==========================================

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Placeholder for passport strategies
console.log('🔐 Passport configuration loaded - strategies will be implemented next');

module.exports = passport;