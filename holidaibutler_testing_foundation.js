// HolidAIButler Data & Testing Foundation
// Complete implementation for launch-ready platform

// =============================================================================
// 1. DATABASE SEEDING SCRIPTS
// =============================================================================

// seeds/index.js - Main seeding orchestrator
const { Pool } = require('pg');
const Redis = require('redis');
const bcrypt = require('bcrypt');
const { faker } = require('@faker-js/faker');

class DatabaseSeeder {
  constructor() {
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL
    });
  }

  async seedAll() {
    console.log('🌱 Starting database seeding...');
    
    try {
      await this.clearDatabase();
      await this.seedCities();
      await this.seedPOIs();
      await this.seedUsers();
      await this.seedPartners();
      await this.seedConversations();
      await this.seedBookings();
      await this.seedReviews();
      await this.setupRedisCache();
      
      console.log('✅ Database seeding completed successfully!');
    } catch (error) {
      console.error('❌ Seeding failed:', error);
      throw error;
    }
  }

  async clearDatabase() {
    const tables = [
      'reviews', 'bookings', 'conversation_messages', 'conversations',
      'partner_accommodations', 'partners', 'pois', 'user_preferences',
      'users', 'cities'
    ];
    
    for (const table of tables) {
      await this.db.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
    }
    
    await this.redis.flushAll();
    console.log('🧹 Database cleared');
  }

  async seedCities() {
    const cities = [
      { name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041, timezone: 'Europe/Amsterdam' },
      { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, timezone: 'Europe/Paris' },
      { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278, timezone: 'Europe/London' },
      { name: 'Barcelona', country: 'Spain', lat: 41.3851, lng: 2.1734, timezone: 'Europe/Madrid' },
      { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964, timezone: 'Europe/Rome' },
      { name: 'Berlin', country: 'Germany', lat: 52.5200, lng: 13.4050, timezone: 'Europe/Berlin' },
      { name: 'Vienna', country: 'Austria', lat: 48.2082, lng: 16.3738, timezone: 'Europe/Vienna' },
      { name: 'Prague', country: 'Czech Republic', lat: 50.0755, lng: 14.4378, timezone: 'Europe/Prague' }
    ];

    for (const city of cities) {
      await this.db.query(
        `INSERT INTO cities (name, country, latitude, longitude, timezone, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [city.name, city.country, city.lat, city.lng, city.timezone]
      );
    }
    
    console.log(`📍 Seeded ${cities.length} cities`);
  }

  async seedPOIs() {
    const cities = await this.db.query('SELECT * FROM cities');
    let totalPOIs = 0;

    for (const city of cities.rows) {
      // Restaurants
      const restaurants = this.generateRestaurants(city, 15);
      await this.insertPOIs(restaurants);
      
      // Attractions
      const attractions = this.generateAttractions(city, 10);
      await this.insertPOIs(attractions);
      
      // Hotels
      const hotels = this.generateHotels(city, 8);
      await this.insertPOIs(hotels);
      
      totalPOIs += restaurants.length + attractions.length + hotels.length;
    }
    
    console.log(`🏛️ Seeded ${totalPOIs} POIs across all cities`);
  }

  generateRestaurants(city, count) {
    const cuisines = ['Italian', 'French', 'Asian', 'Mediterranean', 'Local', 'Fusion', 'Seafood', 'Vegetarian'];
    const priceRanges = ['€', '€€', '€€€', '€€€€'];
    
    return Array.from({ length: count }, () => ({
      city_id: city.id,
      type: 'restaurant',
      name: `${faker.company.name()} Restaurant`,
      description: faker.lorem.paragraph(3),
      latitude: city.latitude + (Math.random() - 0.5) * 0.1,
      longitude: city.longitude + (Math.random() - 0.5) * 0.1,
      address: faker.location.streetAddress(),
      phone: faker.phone.number(),
      website: faker.internet.url(),
      rating: (Math.random() * 2 + 3).toFixed(1), // 3.0 - 5.0
      price_range: faker.helpers.arrayElement(priceRanges),
      cuisine: faker.helpers.arrayElement(cuisines),
      opening_hours: this.generateOpeningHours(),
      features: faker.helpers.arrayElements(['wifi', 'outdoor_seating', 'live_music', 'vegetarian_options', 'delivery'], 3),
      images: [faker.image.urlLoremFlickr({ category: 'restaurant' })]
    }));
  }

  generateAttractions(city, count) {
    const categories = ['museum', 'historical', 'park', 'entertainment', 'cultural', 'religious', 'shopping'];
    
    return Array.from({ length: count }, () => ({
      city_id: city.id,
      type: 'attraction',
      name: `${faker.word.adjective()} ${faker.helpers.arrayElement(['Museum', 'Park', 'Gallery', 'Tower', 'Palace'])}`,
      description: faker.lorem.paragraph(4),
      latitude: city.latitude + (Math.random() - 0.5) * 0.1,
      longitude: city.longitude + (Math.random() - 0.5) * 0.1,
      address: faker.location.streetAddress(),
      phone: faker.phone.number(),
      website: faker.internet.url(),
      rating: (Math.random() * 1.5 + 3.5).toFixed(1),
      price_range: faker.helpers.arrayElement(['Free', '€', '€€', '€€€']),
      category: faker.helpers.arrayElement(categories),
      opening_hours: this.generateOpeningHours(),
      features: faker.helpers.arrayElements(['guided_tours', 'audio_guide', 'wheelchair_accessible', 'family_friendly'], 2),
      images: [faker.image.urlLoremFlickr({ category: 'landmark' })]
    }));
  }

  generateHotels(city, count) {
    const types = ['hotel', 'boutique', 'hostel', 'apartment', 'bed_breakfast'];
    
    return Array.from({ length: count }, () => ({
      city_id: city.id,
      type: 'accommodation',
      name: `${faker.company.name()} ${faker.helpers.arrayElement(['Hotel', 'Inn', 'Suites', 'Lodge'])}`,
      description: faker.lorem.paragraph(3),
      latitude: city.latitude + (Math.random() - 0.5) * 0.08,
      longitude: city.longitude + (Math.random() - 0.5) * 0.08,
      address: faker.location.streetAddress(),
      phone: faker.phone.number(),
      website: faker.internet.url(),
      rating: (Math.random() * 1.5 + 3.5).toFixed(1),
      price_range: faker.helpers.arrayElement(['€€', '€€€', '€€€€']),
      accommodation_type: faker.helpers.arrayElement(types),
      opening_hours: '24/7',
      features: faker.helpers.arrayElements(['wifi', 'pool', 'gym', 'spa', 'restaurant', 'parking', 'pet_friendly'], 4),
      images: [faker.image.urlLoremFlickr({ category: 'hotel' })]
    }));
  }

  generateOpeningHours() {
    return {
      monday: '09:00-18:00',
      tuesday: '09:00-18:00',
      wednesday: '09:00-18:00',
      thursday: '09:00-18:00',
      friday: '09:00-20:00',
      saturday: '10:00-20:00',
      sunday: '10:00-17:00'
    };
  }

  async insertPOIs(pois) {
    for (const poi of pois) {
      await this.db.query(`
        INSERT INTO pois (
          city_id, type, name, description, latitude, longitude, address,
          phone, website, rating, price_range, metadata, features, images, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      `, [
        poi.city_id, poi.type, poi.name, poi.description, poi.latitude, poi.longitude,
        poi.address, poi.phone, poi.website, poi.rating, poi.price_range,
        JSON.stringify({ 
          cuisine: poi.cuisine, 
          category: poi.category, 
          accommodation_type: poi.accommodation_type,
          opening_hours: poi.opening_hours 
        }),
        JSON.stringify(poi.features), JSON.stringify(poi.images)
      ]);
    }
  }

  async seedUsers() {
    const userProfiles = [
      { type: 'budget_traveler', preferences: ['budget', 'hostels', 'street_food', 'walking_tours'] },
      { type: 'luxury_traveler', preferences: ['luxury', 'fine_dining', 'spa', 'private_tours'] },
      { type: 'family_traveler', preferences: ['family_friendly', 'kid_activities', 'safe_areas', 'playgrounds'] },
      { type: 'business_traveler', preferences: ['wifi', 'business_center', 'quick_service', 'transport'] },
      { type: 'adventure_seeker', preferences: ['outdoor', 'sports', 'hiking', 'extreme_activities'] },
      { type: 'culture_enthusiast', preferences: ['museums', 'history', 'art', 'local_culture'] },
      { type: 'foodie', preferences: ['local_cuisine', 'food_tours', 'markets', 'cooking_classes'] },
      { type: 'solo_traveler', preferences: ['safe_areas', 'social_activities', 'hostels', 'guided_tours'] }
    ];

    for (let i = 0; i < 50; i++) {
      const profile = faker.helpers.arrayElement(userProfiles);
      const hashedPassword = await bcrypt.hash('testpassword123', 10);
      
      const userResult = await this.db.query(`
        INSERT INTO users (
          email, password_hash, first_name, last_name, phone,
          date_of_birth, nationality, preferred_language, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id
      `, [
        faker.internet.email(),
        hashedPassword,
        faker.person.firstName(),
        faker.person.lastName(),
        faker.phone.number(),
        faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
        faker.location.countryCode(),
        faker.helpers.arrayElement(['en', 'nl', 'fr', 'de', 'es'])
      ]);

      // Add user preferences
      await this.db.query(`
        INSERT INTO user_preferences (user_id, traveler_type, budget_range, interests, dietary_restrictions)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        userResult.rows[0].id,
        profile.type,
        faker.helpers.arrayElement(['budget', 'mid_range', 'luxury']),
        JSON.stringify(profile.preferences),
        JSON.stringify(faker.helpers.arrayElements(['vegetarian', 'vegan', 'gluten_free', 'none'], 2))
      ]);
    }
    
    console.log('👥 Seeded 50 test users with preferences');
  }

  async seedPartners() {
    const cities = await this.db.query('SELECT * FROM cities');
    
    for (const city of cities.rows) {
      // Create 3-5 partners per city
      const partnerCount = Math.floor(Math.random() * 3) + 3;
      
      for (let i = 0; i < partnerCount; i++) {
        const partnerResult = await this.db.query(`
          INSERT INTO partners (
            name, type, contact_email, contact_phone, address,
            city_id, commission_rate, status, api_credentials, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id
        `, [
          faker.company.name(),
          faker.helpers.arrayElement(['hotel_chain', 'tour_operator', 'restaurant_group', 'activity_provider']),
          faker.internet.email(),
          faker.phone.number(),
          faker.location.streetAddress(),
          city.id,
          Math.random() * 0.15 + 0.05, // 5-20% commission
          'active',
          JSON.stringify({
            api_key: faker.string.uuid(),
            webhook_url: faker.internet.url()
          })
        ]);

        // Create accommodations for hotel partners
        const accommodations = await this.db.query(
          'SELECT id FROM pois WHERE city_id = $1 AND type = $2 LIMIT 3',
          [city.id, 'accommodation']
        );

        for (const acc of accommodations.rows) {
          await this.db.query(`
            INSERT INTO partner_accommodations (partner_id, poi_id, room_types, pricing, availability_calendar)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            partnerResult.rows[0].id,
            acc.id,
            JSON.stringify([
              { type: 'single', capacity: 1, amenities: ['wifi', 'tv'] },
              { type: 'double', capacity: 2, amenities: ['wifi', 'tv', 'minibar'] },
              { type: 'suite', capacity: 4, amenities: ['wifi', 'tv', 'minibar', 'balcony'] }
            ]),
            JSON.stringify({
              single: { base_price: Math.floor(Math.random() * 100) + 50 },
              double: { base_price: Math.floor(Math.random() * 150) + 80 },
              suite: { base_price: Math.floor(Math.random() * 300) + 150 }
            }),
            JSON.stringify({}) // Empty availability calendar
          ]);
        }
      }
    }
    
    console.log('🤝 Seeded partners and accommodations');
  }

  async seedConversations() {
    const users = await this.db.query('SELECT id FROM users LIMIT 30');
    const cities = await this.db.query('SELECT * FROM cities');
    
    for (const user of users.rows) {
      // Create 1-3 conversations per user
      const convCount = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < convCount; i++) {
        const city = faker.helpers.arrayElement(cities.rows);
        const startDate = faker.date.future();
        const endDate = new Date(startDate.getTime() + (Math.random() * 7 + 1) * 24 * 60 * 60 * 1000);
        
        const convResult = await this.db.query(`
          INSERT INTO conversations (
            user_id, city_id, start_date, end_date, budget, travelers_count,
            status, context, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id
        `, [
          user.id,
          city.id,
          startDate,
          endDate,
          Math.floor(Math.random() * 2000) + 500,
          Math.floor(Math.random() * 4) + 1,
          faker.helpers.arrayElement(['active', 'completed', 'paused']),
          JSON.stringify({
            purpose: faker.helpers.arrayElement(['vacation', 'business', 'weekend_getaway', 'honeymoon']),
            special_requests: []
          })
        ]);

        // Add sample messages
        await this.seedConversationMessages(convResult.rows[0].id, city.name);
      }
    }
    
    console.log('💬 Seeded conversations with messages');
  }

  async seedConversationMessages(conversationId, cityName) {
    const messages = [
      {
        role: 'user',
        content: `Hi! I'm planning a trip to ${cityName}. Can you help me find some good restaurants?`,
        message_type: 'text'
      },
      {
        role: 'assistant',
        content: `Hello! I'd love to help you discover amazing restaurants in ${cityName}! To give you the best recommendations, could you tell me what type of cuisine you prefer and your budget range?`,
        message_type: 'text'
      },
      {
        role: 'user',
        content: 'I love Italian food and my budget is around €30-50 per person.',
        message_type: 'text'
      },
      {
        role: 'assistant',
        content: `Perfect! I found some excellent Italian restaurants in your budget range. Here are my top recommendations:`,
        message_type: 'poi_recommendation',
        metadata: JSON.stringify({
          recommendations: [
            { poi_id: 1, reason: 'Excellent pasta dishes and romantic atmosphere' },
            { poi_id: 2, reason: 'Authentic wood-fired pizza and great wine selection' }
          ]
        })
      }
    ];

    for (let i = 0; i < messages.length; i++) {
      await this.db.query(`
        INSERT INTO conversation_messages (
          conversation_id, role, content, message_type, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${i} minutes')
      `, [
        conversationId,
        messages[i].role,
        messages[i].content,
        messages[i].message_type,
        messages[i].metadata || null
      ]);
    }
  }

  async seedBookings() {
    const conversations = await this.db.query(`
      SELECT c.id, c.user_id, c.city_id, c.start_date, c.end_date, c.budget 
      FROM conversations c WHERE c.status = 'completed' LIMIT 20
    `);
    
    for (const conv of conversations.rows) {
      // Create 1-2 bookings per completed conversation
      const bookingCount = Math.floor(Math.random() * 2) + 1;
      
      for (let i = 0; i < bookingCount; i++) {
        const pois = await this.db.query(
          'SELECT id, type FROM pois WHERE city_id = $1 ORDER BY RANDOM() LIMIT 1',
          [conv.city_id]
        );
        
        if (pois.rows.length > 0) {
          const poi = pois.rows[0];
          const price = Math.floor(Math.random() * (conv.budget / 2)) + 50;
          
          await this.db.query(`
            INSERT INTO bookings (
              user_id, conversation_id, poi_id, booking_type, start_date, end_date,
              guests_count, total_price, currency, status, booking_reference,
              payment_status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          `, [
            conv.user_id,
            conv.id,
            poi.id,
            poi.type === 'accommodation' ? 'accommodation' : 'activity',
            conv.start_date,
            poi.type === 'accommodation' ? conv.end_date : conv.start_date,
            Math.floor(Math.random() * 4) + 1,
            price,
            'EUR',
            faker.helpers.arrayElement(['confirmed', 'pending', 'cancelled']),
            faker.string.alphanumeric(8).toUpperCase(),
            faker.helpers.arrayElement(['paid', 'pending', 'failed'])
          ]);
        }
      }
    }
    
    console.log('📅 Seeded booking history');
  }

  async seedReviews() {
    const bookings = await this.db.query(`
      SELECT b.id, b.user_id, b.poi_id 
      FROM bookings b 
      WHERE b.status = 'confirmed' AND b.start_date < NOW()
      LIMIT 40
    `);
    
    for (const booking of bookings.rows) {
      const rating = Math.floor(Math.random() * 3) + 3; // 3-5 stars
      
      await this.db.query(`
        INSERT INTO reviews (
          user_id, poi_id, booking_id, rating, title, content,
          photos, helpful_votes, verified_booking, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        booking.user_id,
        booking.poi_id,
        booking.id,
        rating,
        faker.lorem.sentence(),
        faker.lorem.paragraph(2),
        JSON.stringify([faker.image.urlLoremFlickr()]),
        Math.floor(Math.random() * 20),
        true
      ]);
    }
    
    console.log('⭐ Seeded user reviews');
  }

  async setupRedisCache() {
    await this.redis.connect();
    
    // Cache popular POIs
    const popularPOIs = await this.db.query(`
      SELECT p.*, AVG(r.rating) as avg_rating, COUNT(r.id) as review_count
      FROM pois p
      LEFT JOIN reviews r ON p.id = r.poi_id
      GROUP BY p.id
      HAVING COUNT(r.id) > 0
      ORDER BY avg_rating DESC, review_count DESC
      LIMIT 50
    `);
    
    await this.redis.setEx('popular_pois', 3600, JSON.stringify(popularPOIs.rows));
    
    // Cache city data
    const cities = await this.db.query('SELECT * FROM cities');
    for (const city of cities.rows) {
      await this.redis.setEx(`city:${city.id}`, 3600, JSON.stringify(city));
    }
    
    console.log('🔄 Setup Redis cache with initial data');
  }
}

// =============================================================================
// 2. API TESTING SUITE
// =============================================================================

// tests/setup.js
const { Pool } = require('pg');
const Redis = require('redis');

const testDb = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  ssl: false
});

const testRedis = Redis.createClient({
  url: process.env.TEST_REDIS_URL
});

beforeAll(async () => {
  await testRedis.connect();
});

afterAll(async () => {
  await testDb.end();
  await testRedis.quit();
});

beforeEach(async () => {
  // Clean test database before each test
  await testDb.query('BEGIN');
});

afterEach(async () => {
  await testDb.query('ROLLBACK');
  await testRedis.flushAll();
});

module.exports = { testDb, testRedis };

// tests/controllers/auth.test.js
const request = require('supertest');
const app = require('../../src/app');
const { testDb } = require('../setup');
const bcrypt = require('bcrypt');

describe('Auth Controller', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+31612345678'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    it('should fail with invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toContain('email');
    });

    it('should fail with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toContain('password');
    });

    it('should fail with duplicate email', async () => {
      // Create existing user
      const hashedPassword = await bcrypt.hash('password123', 10);
      await testDb.query(
        'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4)',
        ['test@example.com', hashedPassword, 'Existing', 'User']
      );

      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
      