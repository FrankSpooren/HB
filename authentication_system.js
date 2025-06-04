// ==========================================
// JWT UTILITIES - Token Management
// src/utils/jwt.js
// ==========================================

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const logger = require('./logger');

class JWTService {
  // Generate JWT token
  static generateToken(payload, secret = process.env.JWT_SECRET, expiresIn = process.env.JWT_EXPIRES_IN) {
    return jwt.sign(payload, secret, { expiresIn });
  }

  // Generate refresh token
  static generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN
    });
  }

  // Verify token
  static async verifyToken(token, secret = process.env.JWT_SECRET) {
    try {
      return await promisify(jwt.verify)(token, secret);
    } catch (error) {
      throw new AppError('Invalid token', 401);
    }
  }

  // Generate token pair (access + refresh)
  static generateTokenPair(userId) {
    const payload = { userId };
    return {
      accessToken: this.generateToken(payload),
      refreshToken: this.generateRefreshToken(payload),
      expiresIn: process.env.JWT_EXPIRES_IN
    };
  }

  // Extract token from request
  static extractTokenFromRequest(req) {
    let token = null;

    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // Check query parameter (for WebSocket)
    else if (req.query && req.query.token) {
      token = req.query.token;
    }

    return token;
  }

  // Generate password reset token
  static generatePasswordResetToken() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    return { resetToken, hashedToken };
  }
}

module.exports = JWTService;

// ==========================================
// PASSPORT CONFIGURATION - Authentication Strategies
// src/config/passport.js
// ==========================================

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/User');
const logger = require('../utils/logger');

// JWT Strategy
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    ExtractJwt.fromUrlQueryParameter('token'),
    (req) => req.cookies?.token
  ]),
  secretOrKey: process.env.JWT_SECRET
}, async (payload, done) => {
  try {
    const user = await User.findById(payload.userId).select('+status.isActive +status.isBanned');
    
    if (!user) {
      return done(null, false);
    }

    if (!user.status.isActive || user.status.isBanned) {
      return done(null, false);
    }

    return done(null, user);
  } catch (error) {
    logger.error('JWT Strategy error:', error);
    return done(error, false);
  }
}));

// Local Strategy
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const user = await User.findOne({ email }).select('+password +status.isActive +status.isBanned');
    
    if (!user || !(await user.correctPassword(password, user.password))) {
      return done(null, false, { message: 'Invalid email or password' });
    }

    if (!user.status.isActive) {
      return done(null, false, { message: 'Account is not active' });
    }

    if (user.status.isBanned) {
      return done(null, false, { message: 'Account is banned' });
    }

    // Update login stats
    user.status.lastLogin = new Date();
    user.status.loginCount += 1;
    await user.save({ validateBeforeSave: false });

    return done(null, user);
  } catch (error) {
    logger.error('Local Strategy error:', error);
    return done(error);
  }
}));

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user exists with this Google ID
    let user = await User.findOne({ 'socialAuth.google.id': profile.id });
    
    if (user) {
      // Update last login
      user.status.lastLogin = new Date();
      user.status.loginCount += 1;
      await user.save({ validateBeforeSave: false });
      return done(null, user);
    }

    // Check if user exists with same email
    user = await User.findOne({ email: profile.emails[0].value });
    
    if (user) {
      // Link Google account to existing user
      user.socialAuth.google = {
        id: profile.id,
        email: profile.emails[0].value,
        verified: profile.emails[0].verified
      };
      user.status.lastLogin = new Date();
      user.status.loginCount += 1;
      await user.save({ validateBeforeSave: false });
      return done(null, user);
    }

    // Create new user
    user = new User({
      email: profile.emails[0].value,
      username: profile.emails[0].value.split('@')[0] + '_' + Date.now(),
      profile: {
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        avatar: profile.photos[0]?.value
      },
      socialAuth: {
        google: {
          id: profile.id,
          email: profile.emails[0].value,
          verified: profile.emails[0].verified
        }
      },
      status: {
        isVerified: profile.emails[0].verified,
        lastLogin: new Date(),
        loginCount: 1
      }
    });

    await user.save();
    logger.info(`New Google user created: ${user.email}`);
    
    return done(null, user);
  } catch (error) {
    logger.error('Google Strategy error:', error);
    return done(error);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;

// ==========================================
// AUTHENTICATION MIDDLEWARE
// src/middleware/auth.js
// ==========================================

const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./errorHandler');
const JWTService = require('../utils/jwt');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Protect routes - JWT authentication
const protect = async (req, res, next) => {
  try {
    // 1) Get token
    const token = JWTService.extractTokenFromRequest(req);

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2) Verify token
    const decoded = await JWTService.verifyToken(token);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.userId).select('+status.isActive +status.isBanned');
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // 4) Check if user is active and not banned
    if (!currentUser.status.isActive) {
      return next(new AppError('Your account is not active. Please contact support.', 401));
    }

    if (currentUser.status.isBanned) {
      return next(new AppError('Your account has been banned. Please contact support.', 401));
    }

    // 5) Check if user changed password after the token was issued
    if (currentUser.security.lastPasswordChange) {
      const changedTimestamp = parseInt(currentUser.security.lastPasswordChange.getTime() / 1000, 10);
      if (decoded.iat < changedTimestamp) {
        return next(new AppError('User recently changed password! Please log in again.', 401));
      }
    }

    // Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    return next(new AppError('Invalid token. Please log in again!', 401));
  }
};

// Optional authentication - for routes that work with or without auth
const optionalAuth = async (req, res, next) => {
  try {
    const token = JWTService.extractTokenFromRequest(req);
    
    if (token) {
      const decoded = await JWTService.verifyToken(token);
      const currentUser = await User.findById(decoded.userId).select('+status.isActive +status.isBanned');
      
      if (currentUser && currentUser.status.isActive && !currentUser.status.isBanned) {
        req.user = currentUser;
      }
    }
    
    next();
  } catch (error) {
    // If token is invalid, continue without user
    next();
  }
};

// Restrict to certain roles/permissions
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'premium', 'partner']
    if (!req.user) {
      return next(new AppError('You must be logged in to access this resource.', 401));
    }

    // Check if user has required role (this would need to be added to User model)
    // For now, check premium status
    if (roles.includes('premium') && !req.user.status.isPremium) {
      return next(new AppError('You need a premium account to access this resource.', 403));
    }

    next();
  };
};

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
  message: {
    error: 'Too many authentication attempts, please try again later',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many authentication attempts',
      retryAfter: 15 * 60
    });
  }
});

// Login rate limiting (stricter)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many login attempts, please try again later',
    retryAfter: 15 * 60
  }
});

module.exports = {
  protect,
  optionalAuth,
  restrictTo,
  authLimiter,
  loginLimiter
};

// ==========================================
// AUTHENTICATION CONTROLLER
// src/controllers/authController.js
// ==========================================

const crypto = require('crypto');
const { promisify } = require('util');
const User = require('../models/User');
const JWTService = require('../utils/jwt');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

class AuthController {
  // Register new user
  static async register(req, res, next) {
    try {
      const { email, username, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        const field = existingUser.email === email ? 'email' : 'username';
        return next(new AppError(`User with this ${field} already exists`, 400));
      }

      // Create new user
      const newUser = await User.create({
        email,
        username,
        password,
        profile: {
          firstName,
          lastName
        }
      });

      // Generate email verification token
      const verifyToken = crypto.randomBytes(32).toString('hex');
      newUser.security.emailVerificationToken = crypto.createHash('sha256').update(verifyToken).digest('hex');
      newUser.security.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      await newUser.save({ validateBeforeSave: false });

      // Send verification email
      try {
        await emailService.sendVerificationEmail(newUser.email, verifyToken);
      } catch (error) {
        logger.error('Failed to send verification email:', error);
      }

      // Generate tokens
      const tokens = JWTService.generateTokenPair(newUser._id);

      // Set cookies
      res.cookie('token', tokens.accessToken, {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });

      // Remove password from output
      newUser.password = undefined;

      logger.info(`New user registered: ${newUser.email}`);

      res.status(201).json({
        status: 'success',
        message: 'User registered successfully. Please check your email for verification.',
        tokens,
        user: newUser
      });
    } catch (error) {
      logger.error('Registration error:', error);
      return next(new AppError('Failed to register user', 500));
    }
  }

  // Login user
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Check if email and password exist
      if (!email || !password) {
        return next(new AppError('Please provide email and password!', 400));
      }

      // Check if user exists and password is correct
      const user = await User.findOne({ email }).select('+password +status.isActive +status.isBanned');

      if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect email or password', 401));
      }

      // Check if account is active
      if (!user.status.isActive) {
        return next(new AppError('Your account is not active. Please contact support.', 401));
      }

      if (user.status.isBanned) {
        return next(new AppError('Your account has been banned. Please contact support.', 401));
      }

      // Update login stats
      user.status.lastLogin = new Date();
      user.status.loginCount += 1;
      await user.save({ validateBeforeSave: false });

      // Generate tokens
      const tokens = JWTService.generateTokenPair(user._id);

      // Set cookies
      res.cookie('token', tokens.accessToken, {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });

      // Remove password from output
      user.password = undefined;

      logger.info(`User logged in: ${user.email}`);

      res.status(200).json({
        status: 'success',
        tokens,
        user
      });
    } catch (error) {
      logger.error('Login error:', error);
      return next(new AppError('Login failed', 500));
    }
  }

  // Logout user
  static async logout(req, res) {
    res.cookie('token', 'loggedout', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
  }

  // Refresh token
  static async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return next(new AppError('Refresh token is required', 400));
      }

      // Verify refresh token
      const decoded = await JWTService.verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Check if user exists
      const user = await User.findById(decoded.userId).select('+status.isActive +status.isBanned');
      if (!user || !user.status.isActive || user.status.isBanned) {
        return next(new AppError('Invalid refresh token', 401));
      }

      // Generate new tokens
      const tokens = JWTService.generateTokenPair(user._id);

      res.status(200).json({
        status: 'success',
        tokens
      });
    } catch (error) {
      return next(new AppError('Invalid refresh token', 401));
    }
  }

  // Forgot password
  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      // Get user based on POSTed email
      const user = await User.findOne({ email });
      if (!user) {
        return next(new AppError('There is no user with that email address.', 404));
      }

      // Generate the random reset token
      const resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      try {
        await emailService.sendPasswordResetEmail(user.email, resetToken);

        res.status(200).json({
          status: 'success',
          message: 'Password reset token sent to email!'
        });
      } catch (error) {
        user.security.passwordResetToken = undefined;
        user.security.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        logger.error('Password reset email failed:', error);
        return next(new AppError('There was an error sending the email. Try again later.', 500));
      }
    } catch (error) {
      return next(new AppError('Failed to process password reset request', 500));
    }
  }

  // Reset password
  static async resetPassword(req, res, next) {
    try {
      const { token } = req.params;
      const { password } = req.body;

      // Get user based on the token
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        'security.passwordResetToken': hashedToken,
        'security.passwordResetExpires': { $gt: Date.now() }
      });

      // If token has not expired, and there is user, set the new password
      if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
      }

      user.password = password;
      user.security.passwordResetToken = undefined;
      user.security.passwordResetExpires = undefined;
      user.security.lastPasswordChange = Date.now();
      await user.save();

      // Generate new tokens
      const tokens = JWTService.generateTokenPair(user._id);

      logger.info(`Password reset successful for user: ${user.email}`);

      res.status(200).json({
        status: 'success',
        message: 'Password reset successful',
        tokens
      });
    } catch (error) {
      return next(new AppError('Failed to reset password', 500));
    }
  }

  // Update password (for logged in users)
  static async updatePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      // Get user from collection
      const user = await User.findById(req.user.id).select('+password');

      // Check if POSTed current password is correct
      if (!(await user.correctPassword(currentPassword, user.password))) {
        return next(new AppError('Your current password is wrong.', 401));
      }

      // If so, update password
      user.password = newPassword;
      user.security.lastPasswordChange = Date.now();
      await user.save();

      // Generate new tokens
      const tokens = JWTService.generateTokenPair(user._id);

      res.status(200).json({
        status: 'success',
        message: 'Password updated successfully',
        tokens
      });
    } catch (error) {
      return next(new AppError('Failed to update password', 500));
    }
  }

  // Verify email
  static async verifyEmail(req, res, next) {
    try {
      const { token } = req.params;

      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        'security.emailVerificationToken': hashedToken,
        'security.emailVerificationExpires': { $gt: Date.now() }
      });

      if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
      }

      user.status.isVerified = true;
      user.security.emailVerificationToken = undefined;
      user.security.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });

      logger.info(`Email verified for user: ${user.email}`);

      res.status(200).json({
        status: 'success',
        message: 'Email verified successfully'
      });
    } catch (error) {
      return next(new AppError('Failed to verify email', 500));
    }
  }

  // Get current user
  static async getMe(req, res) {
    res.status(200).json({
      status: 'success',
      user: req.user
    });
  }
}

module.exports = AuthController;

// ==========================================
// AUTHENTICATION ROUTES
// src/routes/auth.js
// ==========================================

const express = require('express');
const passport = require('passport');
const { body } = require('express-validator');
const AuthController = require('../controllers/authController');
const { protect, authLimiter, loginLimiter } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

// Validation schemas
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

const passwordValidation = [
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character')
];

// Authentication routes
router.post('/register', authLimiter, registerValidation, validateRequest, AuthController.register);
router.post('/login', loginLimiter, loginValidation, validateRequest, AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/refresh-token', authLimiter, AuthController.refreshToken);

// Password management
router.post('/forgot-password', authLimiter, AuthController.forgotPassword);
router.patch('/reset-password/:token', authLimiter, passwordValidation, validateRequest, AuthController.resetPassword);
router.patch('/update-password', protect, passwordValidation, validateRequest, AuthController.updatePassword);

// Email verification
router.patch('/verify-email/:token', AuthController.verifyEmail);

// User profile
router.get('/me', protect, AuthController.getMe);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      // Generate tokens for OAuth user
      const tokens = JWTService.generateTokenPair(req.user._id);
      
      // Set cookie
      res.cookie('token', tokens.accessToken, {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });

      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${tokens.accessToken}`);
    } catch (error) {
      res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
    }
  }
);

module.exports = router;

// ==========================================
// VALIDATION MIDDLEWARE
// src/middleware/validation.js
// ==========================================

const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));
    
    return next(new AppError('Validation failed', 400, errorMessages));
  }
  
  next();
};

module.exports = { validateRequest };

// ==========================================
// EMAIL SERVICE PLACEHOLDER
// src/services/emailService.js
// ==========================================

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendVerificationEmail(email, token) {
    const verifyURL = `${process.env.BASE_URL}/api/auth/verify-email/${token}`;
    
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: email,
      subject: 'Verify your HolidAIButler account',
      html: `
        <h2>Welcome to HolidAIButler!</h2>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verifyURL}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `
    };

    await this.transporter.sendMail(mailOptions);
    logger.info(`Verification email sent to: ${email}`);
  }

  async sendPasswordResetEmail(email, token) {
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: email,
      subject: 'Reset your HolidAIButler password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetURL}">Reset Password</a>
        <p>This link will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    await this.transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to: ${email}`);
  }
}

module.exports = new EmailService();