// ==========================================
// HOLIDAIBUTLER - API CONTROLLERS & ROUTES
// ==========================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { body, validationResult, query } = require('express-validator');

// ==========================================
// MIDDLEWARE
// ==========================================

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Role-based authorization
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Error handling middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only images allowed.'));
  }
});

// ==========================================
// UTILITIES
// ==========================================

// Geolocation utilities
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Pagination helper
const getPagination = (page, size) => {
  const limit = size ? +size : 10;
  const offset = page ? page * limit : 0;
  return { limit, offset };
};

// ==========================================
// USER CONTROLLERS
// ==========================================

const userController = {
  // Register new user
  register: [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').trim().isLength({ min: 2 }),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { email, password, name, role = 'guest' } = req.body;
        
        // Check if user exists
        const existingUser = await db.query(
          'SELECT id FROM users WHERE email = ?', [email]
        );
        
        if (existingUser.length > 0) {
          return res.status(409).json({ error: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Create user
        const result = await db.query(
          `INSERT INTO users (email, password, name, role, created_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          [email, hashedPassword, name, role]
        );
        
        const token = jwt.sign(
          { userId: result.insertId, email, role },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        res.status(201).json({
          message: 'User created successfully',
          token,
          user: { id: result.insertId, email, name, role }
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to create user' });
      }
    }
  ],

  // Login user
  login: [
    body('email').isEmail().normalizeEmail(),
    body('password').exists(),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { email, password } = req.body;
        
        const users = await db.query(
          'SELECT * FROM users WHERE email = ?', [email]
        );
        
        if (users.length === 0) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
          { userId: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        });
      } catch (error) {
        res.status(500).json({ error: 'Login failed' });
      }
    }
  ],

  // Get user profile
  getProfile: async (req, res) => {
    try {
      const users = await db.query(
        `SELECT id, email, name, role, phone, avatar, created_at, updated_at 
         FROM users WHERE id = ?`, [req.user.userId]
      );
      
      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(users[0]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get profile' });
    }
  },

  // Update user profile
  updateProfile: [
    body('name').optional().trim().isLength({ min: 2 }),
    body('phone').optional().isMobilePhone(),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { name, phone } = req.body;
        const updateFields = [];
        const values = [];
        
        if (name) {
          updateFields.push('name = ?');
          values.push(name);
        }
        if (phone) {
          updateFields.push('phone = ?');
          values.push(phone);
        }
        
        updateFields.push('updated_at = NOW()');
        values.push(req.user.userId);
        
        await db.query(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
          values
        );
        
        res.json({ message: 'Profile updated successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update profile' });
      }
    }
  ],

  // Upload avatar
  uploadAvatar: [
    upload.single('avatar'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const avatarPath = `/uploads/${req.file.filename}`;
        
        await db.query(
          'UPDATE users SET avatar = ?, updated_at = NOW() WHERE id = ?',
          [avatarPath, req.user.userId]
        );
        
        res.json({ 
          message: 'Avatar uploaded successfully',
          avatar: avatarPath
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to upload avatar' });
      }
    }
  ]
};

// ==========================================
// ACCOMMODATION CONTROLLERS
// ==========================================

const accommodationController = {
  // Get all accommodations with advanced filtering
  getAll: [
    query('page').optional().isInt({ min: 0 }),
    query('size').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('type').optional().isIn(['hotel', 'apartment', 'villa', 'hostel', 'resort']),
    query('priceMin').optional().isFloat({ min: 0 }),
    query('priceMax').optional().isFloat({ min: 0 }),
    query('rating').optional().isFloat({ min: 0, max: 5 }),
    query('lat').optional().isFloat(),
    query('lng').optional().isFloat(),
    query('radius').optional().isFloat({ min: 0, max: 100 }),
    query('amenities').optional(),
    query('sortBy').optional().isIn(['price', 'rating', 'distance', 'created_at']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { 
          page = 0, size = 10, search, type, priceMin, priceMax, 
          rating, lat, lng, radius = 10, amenities, 
          sortBy = 'created_at', sortOrder = 'desc' 
        } = req.query;
        
        const { limit, offset } = getPagination(page, size);
        
        let whereConditions = ['a.status = "active"'];
        let queryParams = [];
        let joins = [];
        let selects = [
          'a.*',
          'AVG(r.rating) as avg_rating',
          'COUNT(r.id) as review_count'
        ];
        
        // Search functionality
        if (search) {
          whereConditions.push('(a.name LIKE ? OR a.description LIKE ? OR a.location LIKE ?)');
          const searchTerm = `%${search}%`;
          queryParams.push(searchTerm, searchTerm, searchTerm);
        }
        
        // Type filter
        if (type) {
          whereConditions.push('a.type = ?');
          queryParams.push(type);
        }
        
        // Price range filter
        if (priceMin) {
          whereConditions.push('a.price_per_night >= ?');
          queryParams.push(priceMin);
        }
        if (priceMax) {
          whereConditions.push('a.price_per_night <= ?');
          queryParams.push(priceMax);
        }
        
        // Rating filter
        if (rating) {
          joins.push('INNER JOIN reviews r2 ON a.id = r2.accommodation_id');
          whereConditions.push('r2.rating >= ?');
          queryParams.push(rating);
        }
        
        // Geolocation filter
        if (lat && lng) {
          selects.push(`(
            6371 * acos(
              cos(radians(?)) * cos(radians(a.latitude)) * 
              cos(radians(a.longitude) - radians(?)) + 
              sin(radians(?)) * sin(radians(a.latitude))
            )
          ) AS distance`);
          queryParams.unshift(lat, lng, lat);
          
          if (radius) {
            whereConditions.push(`(
              6371 * acos(
                cos(radians(?)) * cos(radians(a.latitude)) * 
                cos(radians(a.longitude) - radians(?)) + 
                sin(radians(?)) * sin(radians(a.latitude))
              )
            ) <= ?`);
            queryParams.push(lat, lng, lat, radius);
          }
        }
        
        // Amenities filter
        if (amenities) {
          const amenityList = amenities.split(',');
          amenityList.forEach(amenity => {
            whereConditions.push('JSON_CONTAINS(a.amenities, ?)');
            queryParams.push(`"${amenity.trim()}"`);
          });
        }
        
        // Base query
        let query = `
          SELECT ${selects.join(', ')}
          FROM accommodations a
          LEFT JOIN reviews r ON a.id = r.accommodation_id
          ${joins.join(' ')}
          WHERE ${whereConditions.join(' AND ')}
          GROUP BY a.id
        `;
        
        // Sorting
        let orderBy = '';
        switch (sortBy) {
          case 'price':
            orderBy = `ORDER BY a.price_per_night ${sortOrder}`;
            break;
          case 'rating':
            orderBy = `ORDER BY avg_rating ${sortOrder}`;
            break;
          case 'distance':
            if (lat && lng) {
              orderBy = `ORDER BY distance ${sortOrder}`;
            } else {
              orderBy = `ORDER BY a.created_at ${sortOrder}`;
            }
            break;
          default:
            orderBy = `ORDER BY a.${sortBy} ${sortOrder}`;
        }
        
        query += ` ${orderBy} LIMIT ? OFFSET ?`;
        queryParams.push(limit, offset);
        
        const accommodations = await db.query(query, queryParams);
        
        // Get total count for pagination
        const countQuery = `
          SELECT COUNT(DISTINCT a.id) as total
          FROM accommodations a
          LEFT JOIN reviews r ON a.id = r.accommodation_id
          ${joins.join(' ')}
          WHERE ${whereConditions.join(' AND ')}
        `;
        
        const countResult = await db.query(countQuery, queryParams.slice(0, -2));
        const total = countResult[0].total;
        
        res.json({
          accommodations,
          pagination: {
            page: parseInt(page),
            size: parseInt(size),
            total,
            pages: Math.ceil(total / size)
          }
        });
      } catch (error) {
        console.error('Error fetching accommodations:', error);
        res.status(500).json({ error: 'Failed to fetch accommodations' });
      }
    }
  ],

  // Get single accommodation
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const accommodations = await db.query(`
        SELECT a.*, 
               AVG(r.rating) as avg_rating,
               COUNT(r.id) as review_count,
               u.name as host_name,
               u.email as host_email,
               u.avatar as host_avatar
        FROM accommodations a
        LEFT JOIN reviews r ON a.id = r.accommodation_id
        LEFT JOIN users u ON a.host_id = u.id
        WHERE a.id = ? AND a.status = 'active'
        GROUP BY a.id
      `, [id]);
      
      if (accommodations.length === 0) {
        return res.status(404).json({ error: 'Accommodation not found' });
      }
      
      // Get recent reviews
      const reviews = await db.query(`
        SELECT r.*, u.name as user_name, u.avatar as user_avatar
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.accommodation_id = ?
        ORDER BY r.created_at DESC
        LIMIT 10
      `, [id]);
      
      // Get availability calendar (next 30 days)
      const availability = await db.query(`
        SELECT date, available, price
        FROM accommodation_availability
        WHERE accommodation_id = ? 
        AND date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        ORDER BY date
      `, [id]);
      
      const accommodation = accommodations[0];
      accommodation.reviews = reviews;
      accommodation.availability = availability;
      
      res.json(accommodation);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch accommodation' });
    }
  ],

  // Create accommodation (host only)
  create: [
    authenticateToken,
    requireRole(['host', 'admin']),
    body('name').trim().isLength({ min: 3 }),
    body('description').trim().isLength({ min: 10 }),
    body('type').isIn(['hotel', 'apartment', 'villa', 'hostel', 'resort']),
    body('location').trim().isLength({ min: 5 }),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('price_per_night').isFloat({ min: 0 }),
    body('max_guests').isInt({ min: 1 }),
    body('bedrooms').isInt({ min: 0 }),
    body('bathrooms').isInt({ min: 1 }),
    body('amenities').isArray(),
    handleValidationErrors,
    async (req, res) => {
      try {
        const {
          name, description, type, location, latitude, longitude,
          price_per_night, max_guests, bedrooms, bathrooms, amenities
        } = req.body;
        
        const result = await db.query(`
          INSERT INTO accommodations (
            host_id, name, description, type, location, latitude, longitude,
            price_per_night, max_guests, bedrooms, bathrooms, amenities,
            status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
        `, [
          req.user.userId, name, description, type, location, latitude, longitude,
          price_per_night, max_guests, bedrooms, bathrooms, JSON.stringify(amenities)
        ]);
        
        res.status(201).json({
          message: 'Accommodation created successfully',
          accommodationId: result.insertId
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to create accommodation' });
      }
    }
  ],

  // Update accommodation
  update: [
    authenticateToken,
    body('name').optional().trim().isLength({ min: 3 }),
    body('description').optional().trim().isLength({ min: 10 }),
    body('price_per_night').optional().isFloat({ min: 0 }),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Check ownership or admin
        const accommodations = await db.query(
          'SELECT host_id FROM accommodations WHERE id = ?', [id]
        );
        
        if (accommodations.length === 0) {
          return res.status(404).json({ error: 'Accommodation not found' });
        }
        
        if (accommodations[0].host_id !== req.user.userId && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        const updateFields = [];
        const values = [];
        
        Object.entries(req.body).forEach(([key, value]) => {
          if (value !== undefined) {
            updateFields.push(`${key} = ?`);
            values.push(typeof value === 'object' ? JSON.stringify(value) : value);
          }
        });
        
        updateFields.push('updated_at = NOW()');
        values.push(id);
        
        await db.query(
          `UPDATE accommodations SET ${updateFields.join(', ')} WHERE id = ?`,
          values
        );
        
        res.json({ message: 'Accommodation updated successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update accommodation' });
      }
    }
  ],

  // Upload accommodation images
  uploadImages: [
    authenticateToken,
    upload.array('images', 10),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Check ownership
        const accommodations = await db.query(
          'SELECT host_id FROM accommodations WHERE id = ?', [id]
        );
        
        if (accommodations.length === 0) {
          return res.status(404).json({ error: 'Accommodation not found' });
        }
        
        if (accommodations[0].host_id !== req.user.userId && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: 'No files uploaded' });
        }
        
        const imageUrls = req.files.map(file => `/uploads/${file.filename}`);
        
        // Insert image records
        const insertPromises = imageUrls.map(url => 
          db.query(
            'INSERT INTO accommodation_images (accommodation_id, image_url, created_at) VALUES (?, ?, NOW())',
            [id, url]
          )
        );
        
        await Promise.all(insertPromises);
        
        res.json({
          message: 'Images uploaded successfully',
          images: imageUrls
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to upload images' });
      }
    }
  ]
};

// ==========================================
// BOOKING CONTROLLERS
// ==========================================

const bookingController = {
  // Create booking with availability check
  create: [
    authenticateToken,
    body('accommodation_id').isInt(),
    body('check_in').isISO8601(),
    body('check_out').isISO8601(),
    body('guests').isInt({ min: 1 }),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { accommodation_id, check_in, check_out, guests } = req.body;
        const user_id = req.user.userId;
        
        // Validate dates
        const checkInDate = new Date(check_in);
        const checkOutDate = new Date(check_out);
        const now = new Date();
        
        if (checkInDate < now) {
          return res.status(400).json({ error: 'Check-in date cannot be in the past' });
        }
        
        if (checkOutDate <= checkInDate) {
          return res.status(400).json({ error: 'Check-out must be after check-in' });
        }
        
        // Check accommodation exists and get details
        const accommodations = await db.query(`
          SELECT id, max_guests, price_per_night, host_id
          FROM accommodations 
          WHERE id = ? AND status = 'active'
        `, [accommodation_id]);
        
        if (accommodations.length === 0) {
          return res.status(404).json({ error: 'Accommodation not found' });
        }
        
        const accommodation = accommodations[0];
        
        if (guests > accommodation.max_guests) {
          return res.status(400).json({ error: 'Too many guests for this accommodation' });
        }
        
        if (accommodation.host_id === user_id) {
          return res.status(400).json({ error: 'Cannot book your own accommodation' });
        }
        
        // Check availability
        const conflictingBookings = await db.query(`
          SELECT id FROM bookings 
          WHERE accommodation_id = ? 
          AND status IN ('confirmed', 'pending')
          AND (
            (check_in <= ? AND check_out > ?) OR
            (check_in < ? AND check_out >= ?) OR
            (check_in >= ? AND check_out <= ?)
          )
        `, [
          accommodation_id, check_in, check_in, check_out, check_out, check_in, check_out
        ]);
        
        if (conflictingBookings.length > 0) {
          return res.status(409).json({ error: 'Accommodation not available for selected dates' });
        }
        
        // Calculate total price
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        const total_price = nights * accommodation.price_per_night;
        
        // Create booking
        const result = await db.query(`
          INSERT INTO bookings (
            user_id, accommodation_id, check_in, check_out, guests, 
            total_price, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
        `, [user_id, accommodation_id, check_in, check_out, guests, total_price]);
        
        res.status(201).json({
          message: 'Booking created successfully',
          bookingId: result.insertId,
          total_price,
          nights
        });
      } catch (error) {
        console.error('Booking creation error:', error);
        res.status(500).json({ error: 'Failed to create booking' });
      }
    }
  ],

  // Get user bookings
  getUserBookings: [
    authenticateToken,
    query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'completed']),
    query('page').optional().isInt({ min: 0 }),
    query('size').optional().isInt({ min: 1, max: 100 }),
    async (req, res) => {
      try {
        const { status, page = 0, size = 10 } = req.query;
        const { limit, offset } = getPagination(page, size);
        
        let whereCondition = 'b.user_id = ?';
        let queryParams = [req.user.userId];
        
        if (status) {
          whereCondition += ' AND b.status = ?';
          queryParams.push(status);
        }
        
        const bookings = await db.query(`
          SELECT b.*, a.name as accommodation_name, a.location, a.type,
                 ai.image_url as accommodation_image
          FROM bookings b
          JOIN accommodations a ON b.accommodation_id = a.id
          LEFT JOIN accommodation_images ai ON a.id = ai.accommodation_id
          WHERE ${whereCondition}
          GROUP BY b.id
          ORDER BY b.created_at DESC
          LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);
        
        // Get total count
        const countResult = await db.query(`
          SELECT COUNT(*) as total
          FROM bookings b
          WHERE ${whereCondition}
        `, queryParams);
        
        res.json({
          bookings,
          pagination: {
            page: parseInt(page),
            size: parseInt(size),
            total: countResult[0].total,
            pages: Math.ceil(countResult[0].total / size)
          }
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
      }
    }
  ],

  // Get host bookings
  getHostBookings: [
    authenticateToken,
    requireRole(['host', 'admin']),
    async (req, res) => {
      try {
        const bookings = await db.query(`
          SELECT b.*, a.name as accommodation_name, 
                 u.name as guest_name, u.email as guest_email
          FROM bookings b
          JOIN accommodations a ON b.accommodation_id = a.id
          JOIN users u ON b.user_id = u.id
          WHERE a.host_id = ?
          ORDER BY b.created_at DESC
        `, [req.user.userId]);
        
        res.json(bookings);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch host bookings' });
      }
    }
  ],

  // Update booking status
  updateStatus: [
    authenticateToken,
    body('status').isIn(['confirmed', 'cancelled']),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
        
        // Get booking details
        const bookings = await db.query(`
          SELECT b.*, a.host_id
          FROM bookings b
          JOIN accommodations a ON b.accommodation_id = a.id
          WHERE b.id = ?
        `, [id]);
        
        if (bookings.length === 0) {
          return res.status(404).json({ error: 'Booking not found' });
        }
        
        const booking = bookings[0];
        
        // Check permissions
        const canUpdate = (
          req.user.userId === booking.user_id || // Guest can cancel
          req.user.userId === booking.host_id || // Host can confirm/cancel
          req.user.role === 'admin'
        );
        
        if (!canUpdate) {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        // Validate status transition
        if (booking.status === 'cancelled' || booking.status === 'completed') {
          return res.status(400).json({ error: 'Cannot modify completed or cancelled booking' });
        }
        
        await db.query(
          'UPDATE bookings SET status = ?, updated_at = NOW() WHERE id = ?',
          [status, id]
        );
        
        res.json({ message: 'Booking status updated successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update booking status' });
      }
    }
  ]
};

// ==========================================
// REVIEW CONTROLLERS
// ==========================================

const reviewController = {
  // Create review
  create: [
    authenticateToken,
    body('accommodation_id').isInt(),
    body('rating').isFloat({ min: 1, max: 5 }),
    body('comment').trim().isLength({ min: 10 }),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { accommodation_id, rating, comment } = req.body;
        const user_id = req.user.userId;
        
        // Check if user has completed booking for this accommodation
        const bookings = await db.query(`
          SELECT id FROM bookings 
          WHERE user_id = ? AND accommodation_id = ? 
          AND status = 'completed' AND check_out < NOW()
        `, [user_id, accommodation_id]);
        
        if (bookings.length === 0) {
          return res.status(400).json({ 
            error: 'You can only review accommodations you have stayed at' 
          });
        }
        
        // Check if review already exists
        const existingReviews = await db.query(
          'SELECT id FROM reviews WHERE user_id = ? AND accommodation_id = ?',
          [user_id, accommodation_id]
        );
        
        if (existingReviews.length > 0) {
          return res.status(409).json({ error: 'You have already reviewed this accommodation' });
        }
        
        const result = await db.query(`
          INSERT INTO reviews (user_id, accommodation_id, rating, comment, created_at)
          VALUES (?, ?, ?, ?, NOW())
        `, [user_id, accommodation_id, rating, comment]);
        
        res.status(201).json({
          message: 'Review created successfully',
          reviewId: result.insertId
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to create review' });
      }
    }
  ],

  // Get accommodation reviews
  getByAccommodation: [
    query('page').optional().isInt({ min: 0 }),
    query('size').optional().isInt({ min: 1, max: 100 }),
    query('rating').optional().isFloat({ min: 1, max: 5 }),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { page = 0, size = 10, rating } = req.query;
        const { limit, offset } = getPagination(page, size);
        
        let whereCondition = 'r.accommodation_id = ?';
        let queryParams = [id];
        
        if (rating) {
          whereCondition += ' AND r.rating = ?';
          queryParams.push(rating);
        }
        
        const reviews = await db.query(`
          SELECT r.*, u.name as user_name, u.avatar as user_avatar
          FROM reviews r
          JOIN users u ON r.user_id = u.id
          WHERE ${whereCondition}
          ORDER BY r.created_at DESC
          LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);
        
        const countResult = await db.query(`
          SELECT COUNT(*) as total
          FROM reviews r
          WHERE ${whereCondition}
        `, queryParams);
        
        res.json({
          reviews,
          pagination: {
            page: parseInt(page),
            size: parseInt(size),
            total: countResult[0].total,
            pages: Math.ceil(countResult[0].total / size)
          }
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reviews' });
      }
    }
  ]
};

// ==========================================
// DESTINATION CONTROLLERS
// ==========================================

const destinationController = {
  // Get popular destinations
  getPopular: async (req, res) => {
    try {
      const destinations = await db.query(`
        SELECT d.*, COUNT(a.id) as accommodation_count,
               AVG(r.rating) as avg_rating
        FROM destinations d
        LEFT JOIN accommodations a ON d.id = a.destination_id
        LEFT JOIN reviews r ON a.id = r.accommodation_id
        WHERE d.featured = 1
        GROUP BY d.id
        ORDER BY accommodation_count DESC, avg_rating DESC
        LIMIT 12
      `);
      
      res.json(destinations);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch destinations' });
    }
  },

  // Search destinations
  search: [
    query('q').trim().isLength({ min: 2 }),
    query('lat').optional().isFloat(),
    query('lng').optional().isFloat(),
    handleValidationErrors,
    async (req, res) => {
      try {
        const { q, lat, lng } = req.query;
        
        let query = `
          SELECT d.*, COUNT(a.id) as accommodation_count
          FROM destinations d
          LEFT JOIN accommodations a ON d.id = a.destination_id
          WHERE d.name LIKE ? OR d.country LIKE ? OR d.description LIKE ?
          GROUP BY d.id
        `;
        
        let queryParams = [`%${q}%`, `%${q}%`, `%${q}%`];
        
        if (lat && lng) {
          query = `
            SELECT d.*, COUNT(a.id) as accommodation_count,
                   (6371 * acos(cos(radians(?)) * cos(radians(d.latitude)) * 
                   cos(radians(d.longitude) - radians(?)) + 
                   sin(radians(?)) * sin(radians(d.latitude)))) AS distance
            FROM destinations d
            LEFT JOIN accommodations a ON d.id = a.destination_id
            WHERE d.name LIKE ? OR d.country LIKE ? OR d.description LIKE ?
            GROUP BY d.id
            ORDER BY distance ASC
          `;
          queryParams = [lat, lng, lat, `%${q}%`, `%${q}%`, `%${q}%`];
        } else {
          query += ' ORDER BY accommodation_count DESC';
        }
        
        query += ' LIMIT 20';
        
        const destinations = await db.query(query, queryParams);
        res.json(destinations);
      } catch (error) {
        res.status(500).json({ error: 'Failed to search destinations' });
      }
    }
  ]
};

// ==========================================
// ROUTES SETUP
// ==========================================

const router = express.Router();

// User routes
router.post('/auth/register', userController.register);
router.post('/auth/login', userController.login);
router.get('/users/profile', authenticateToken, userController.getProfile);
router.put('/users/profile', authenticateToken, userController.updateProfile);
router.post('/users/avatar', authenticateToken, userController.uploadAvatar);

// Accommodation routes
router.get('/accommodations', accommodationController.getAll);
router.get('/accommodations/:id', accommodationController.getById);
router.post('/accommodations', accommodationController.create);
router.put('/accommodations/:id', accommodationController.update);
router.post('/accommodations/:id/images', accommodationController.uploadImages);

// Booking routes
router.post('/bookings', bookingController.create);
router.get('/bookings/user', bookingController.getUserBookings);
router.get('/bookings/host', bookingController.getHostBookings);
router.put('/bookings/:id/status', bookingController.updateStatus);

// Review routes
router.post('/reviews', reviewController.create);
router.get('/accommodations/:id/reviews', reviewController.getByAccommodation);

// Destination routes
router.get('/destinations/popular', destinationController.getPopular);
router.get('/destinations/search', destinationController.search);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;