# ==========================================
# .env.example - Main Environment Template
# ==========================================

# ==========================================
# APPLICATION SETTINGS
# ==========================================
NODE_ENV=development
APP_NAME=HolidAIButler
APP_VERSION=1.0.0
PORT=3000
HOST=localhost
BASE_URL=http://localhost:3000

# ==========================================
# DATABASE CONFIGURATION
# ==========================================
# MongoDB Settings
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=password123
MONGO_DB_NAME=holidaibutler
MONGODB_URI=mongodb://admin:password123@localhost:27017/holidaibutler?authSource=admin

# MongoDB Connection Options
MONGO_MAX_POOL_SIZE=10
MONGO_MIN_POOL_SIZE=5
MONGO_MAX_IDLE_TIME=30000
MONGO_SERVER_SELECTION_TIMEOUT=5000

# ==========================================
# REDIS CONFIGURATION
# ==========================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis123
REDIS_URL=redis://:redis123@localhost:6379
REDIS_DB=0
REDIS_TTL=3600

# Redis Connection Pool
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000
REDIS_CONNECTION_TIMEOUT=5000

# ==========================================
# AUTHENTICATION & SECURITY
# ==========================================
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-token-secret-change-in-production
JWT_REFRESH_EXPIRES_IN=30d

# Session Configuration
SESSION_SECRET=your-session-secret-change-in-production
SESSION_TIMEOUT=24h
SESSION_SECURE=false

# Password Policy
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SYMBOLS=true

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# ==========================================
# SOCIAL AUTHENTICATION
# ==========================================
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Apple Sign In
APPLE_CLIENT_ID=com.holidaibutler.app
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY_PATH=./keys/AuthKey_your-key-id.p8
APPLE_CALLBACK_URL=http://localhost:3000/api/auth/apple/callback

# ==========================================
# AI SERVICES
# ==========================================
# Claude AI Configuration
CLAUDE_API_KEY=your-claude-api-key-from-anthropic
CLAUDE_MODEL=claude-3-haiku-20240307
CLAUDE_MAX_TOKENS=4000
CLAUDE_TEMPERATURE=0.7
CLAUDE_BASE_URL=https://api.anthropic.com

# AI Rate Limiting
AI_REQUESTS_PER_MINUTE=60
AI_REQUESTS_PER_DAY=1000
AI_MAX_CONVERSATION_LENGTH=50

# ==========================================
# PAYMENT PROCESSING
# ==========================================
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret
STRIPE_SUCCESS_URL=http://localhost:3000/payment/success
STRIPE_CANCEL_URL=http://localhost:3000/payment/cancel

# Payment Settings
DEFAULT_CURRENCY=EUR
COMMISSION_RATE=0.15
MINIMUM_BOOKING_AMOUNT=10
MAXIMUM_BOOKING_AMOUNT=10000

# ==========================================
# EMAIL SERVICES
# ==========================================
# SMTP Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=noreply@holidaibutler.com
EMAIL_PASS=your-email-app-password
EMAIL_FROM_NAME=HolidAIButler
EMAIL_FROM_ADDRESS=noreply@holidaibutler.com

# Email Templates
EMAIL_TEMPLATE_WELCOME=welcome
EMAIL_TEMPLATE_VERIFICATION=email-verification
EMAIL_TEMPLATE_PASSWORD_RESET=password-reset
EMAIL_TEMPLATE_BOOKING_CONFIRMATION=booking-confirmation

# ==========================================
# SMS SERVICES
# ==========================================
# Twilio Configuration
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_VERIFY_SERVICE_SID=your-verify-service-sid

# SMS Settings
SMS_ENABLED=true
SMS_VERIFICATION_ENABLED=true
SMS_RATE_LIMIT=5

# ==========================================
# CLOUD STORAGE
# ==========================================
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

# Upload Settings
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf
UPLOAD_PATH=./uploads
CLOUDINARY_FOLDER=holidaibutler

# ==========================================
# EXTERNAL APIS
# ==========================================
# Google Maps & Places
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
GOOGLE_PLACES_API_KEY=your-google-places-api-key

# Weather API
WEATHER_API_KEY=your-openweathermap-api-key
WEATHER_BASE_URL=https://api.openweathermap.org/data/2.5

# Currency Exchange
EXCHANGE_API_KEY=your-exchange-rates-api-key
EXCHANGE_BASE_URL=https://api.exchangerate-api.com/v4/latest

# ==========================================
# MONITORING & LOGGING
# ==========================================
# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
LOG_DATE_PATTERN=YYYY-MM-DD

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
GRAFANA_ENABLED=true
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin123

# Error Tracking (Optional - Sentry)
SENTRY_DSN=your-sentry-dsn-url
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.1

# ==========================================
# DEVELOPMENT SETTINGS
# ==========================================
# Debug Configuration
DEBUG=holidaibutler:*
DEBUG_COLORS=true
DEBUG_DEPTH=2

# Development Tools
WEBPACK_DEV_SERVER=true
HOT_RELOAD=true
SOURCE_MAPS=true

# Testing
TEST_DATABASE_URL=mongodb://admin:password123@localhost:27017/holidaibutler_test?authSource=admin
TEST_REDIS_URL=redis://:redis123@localhost:6379/1

---
# ==========================================
# .env.development - Development Environment
# ==========================================

NODE_ENV=development
PORT=3000
HOST=localhost
BASE_URL=http://localhost:3000

# Development Database
MONGODB_URI=mongodb://admin:password123@localhost:27017/holidaibutler_dev?authSource=admin
REDIS_URL=redis://:redis123@localhost:6379/0

# Development Keys (Use test keys only)
JWT_SECRET=dev-jwt-secret-key-not-for-production
CLAUDE_API_KEY=your-claude-dev-api-key
STRIPE_SECRET_KEY=sk_test_your-stripe-test-key

# Development Email (Use test service)
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=your-mailtrap-username
EMAIL_PASS=your-mailtrap-password

# Development Settings
DEBUG=holidaibutler:*
LOG_LEVEL=debug
RATE_LIMIT_WINDOW=1
RATE_LIMIT_MAX_REQUESTS=1000

# Development Social Auth
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
APPLE_CALLBACK_URL=http://localhost:3000/api/auth/apple/callback

---
# ==========================================
# .env.production - Production Environment
# ==========================================

NODE_ENV=production
PORT=3000
HOST=0.0.0.0
BASE_URL=https://api.holidaibutler.com

# Production Database (Use environment variables from hosting provider)
MONGODB_URI=${MONGODB_URI}
REDIS_URL=${REDIS_URL}

# Production Security
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
SESSION_SECURE=true

# Production APIs
CLAUDE_API_KEY=${CLAUDE_API_KEY}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}

# Production Email
EMAIL_HOST=${EMAIL_HOST}
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=${EMAIL_USER}
EMAIL_PASS=${EMAIL_PASS}

# Production Logging
LOG_LEVEL=warn
SENTRY_DSN=${SENTRY_DSN}
SENTRY_ENVIRONMENT=production

# Production Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# Production Callbacks
GOOGLE_CALLBACK_URL=https://api.holidaibutler.com/api/auth/google/callback
APPLE_CALLBACK_URL=https://api.holidaibutler.com/api/auth/apple/callback

---
# ==========================================
# .env.test - Testing Environment
# ==========================================

NODE_ENV=test
PORT=3001
HOST=localhost

# Test Database
MONGODB_URI=mongodb://admin:password123@localhost:27017/holidaibutler_test?authSource=admin
REDIS_URL=redis://:redis123@localhost:6379/2

# Test Security
JWT_SECRET=test-jwt-secret-key
SESSION_SECRET=test-session-secret

# Test Settings
LOG_LEVEL=error
DEBUG=false
RATE_LIMIT_MAX_REQUESTS=10000

# Test Services (Mock/Disabled)
EMAIL_HOST=mock
TWILIO_ACCOUNT_SID=test
CLAUDE_API_KEY=test-key
STRIPE_SECRET_KEY=sk_test_mock

---
# ==========================================
# frontend/.env.example - React Native Frontend
# ==========================================

# ==========================================
# API CONFIGURATION
# ==========================================
API_BASE_URL=http://localhost:3000/api
WEBSOCKET_URL=ws://localhost:3000

# ==========================================
# EXPO CONFIGURATION
# ==========================================
EXPO_PUBLIC_APP_NAME=HolidAIButler
EXPO_PUBLIC_APP_VERSION=1.0.0
EXPO_PUBLIC_APP_SCHEME=holidaibutler

# ==========================================
# GOOGLE SERVICES
# ==========================================
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.googleusercontent.com

# Google Maps Configuration
EXPO_PUBLIC_MAPS_REGION_LATITUDE=52.3676
EXPO_PUBLIC_MAPS_REGION_LONGITUDE=4.9041
EXPO_PUBLIC_MAPS_REGION_DELTA=0.0922

# ==========================================
# APPLE SERVICES
# ==========================================
EXPO_PUBLIC_APPLE_CLIENT_ID=com.holidaibutler.app

# ==========================================
# STRIPE PAYMENT
# ==========================================
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key

# ==========================================
# FEATURE FLAGS
# ==========================================
EXPO_PUBLIC_ENABLE_VOICE_INPUT=true
EXPO_PUBLIC_ENABLE_OFFLINE_MODE=true
EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS=true
EXPO_PUBLIC_ENABLE_BIOMETRIC_AUTH=true
EXPO_PUBLIC_ENABLE_ANALYTICS=true
EXPO_PUBLIC_ENABLE_CRASH_REPORTING=true

# ==========================================
# APP CONFIGURATION
# ==========================================
EXPO_PUBLIC_DEFAULT_LANGUAGE=en
EXPO_PUBLIC_DEFAULT_CURRENCY=EUR
EXPO_PUBLIC_DEFAULT_UNITS=metric
EXPO_PUBLIC_DEFAULT_THEME=auto

# ==========================================
# DEVELOPMENT SETTINGS
# ==========================================
EXPO_PUBLIC_DEV_MODE=true
EXPO_PUBLIC_DEBUG_ENABLED=true
EXPO_PUBLIC_MOCK_API=false

# ==========================================
# ANALYTICS & MONITORING
# ==========================================
EXPO_PUBLIC_ANALYTICS_ID=your-analytics-id
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn

---
# ==========================================
# frontend/.env.development
# ==========================================

# Development API
API_BASE_URL=http://localhost:3000/api
WEBSOCKET_URL=ws://localhost:3000

# Development settings
EXPO_PUBLIC_DEV_MODE=true
EXPO_PUBLIC_DEBUG_ENABLED=true
EXPO_PUBLIC_MOCK_API=false

# Development maps (free tier)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-dev-google-maps-key

# Development Stripe
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-test-key

---
# ==========================================
# frontend/.env.production
# ==========================================

# Production API
API_BASE_URL=https://api.holidaibutler.com/api
WEBSOCKET_URL=wss://api.holidaibutler.com

# Production settings
EXPO_PUBLIC_DEV_MODE=false
EXPO_PUBLIC_DEBUG_ENABLED=false
EXPO_PUBLIC_MOCK_API=false

# Production services
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}

# Production monitoring
EXPO_PUBLIC_ANALYTICS_ID=${ANALYTICS_ID}
EXPO_PUBLIC_SENTRY_DSN=${SENTRY_DSN}

---
# ==========================================
# docker/.env.docker - Docker Environment
# ==========================================

# Docker Compose Configuration
COMPOSE_PROJECT_NAME=holidaibutler
COMPOSE_FILE=docker-compose.yml

# Container Settings
RESTART_POLICY=unless-stopped
DOCKER_NETWORK=holidaibutler-network

# Database Containers
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=secure-mongo-password-2024
MONGO_DB_NAME=holidaibutler
MONGO_VOLUME=mongodb_data

REDIS_PASSWORD=secure-redis-password-2024
REDIS_VOLUME=redis_data

# Application Containers
BACKEND_PORT=3000
FRONTEND_PORT=19000
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
GRAFANA_USER=admin
GRAFANA_PASSWORD=secure-grafana-password-2024

ELASTICSEARCH_PORT=9200
KIBANA_PORT=5601

# SSL Configuration
SSL_CERT_PATH=./nginx/ssl/cert.pem
SSL_KEY_PATH=./nginx/ssl/key.pem

# Backup Configuration
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=./backup

---
# ==========================================
# .env.local.example - Local Development Override
# ==========================================

# Local overrides for development
# Copy this to .env.local and customize for your local setup

# Local Database (if running without Docker)
MONGODB_URI=mongodb://localhost:27017/holidaibutler_local
REDIS_URL=redis://localhost:6379

# Local API Keys (for testing)
CLAUDE_API_KEY=your-personal-claude-api-key
GOOGLE_MAPS_API_KEY=your-personal-google-maps-key

# Local Email (for testing)
EMAIL_HOST=localhost
EMAIL_PORT=1025
EMAIL_USER=test
EMAIL_PASS=test

# Local Development Settings
DEBUG=holidaibutler:*
LOG_LEVEL=debug
HOT_RELOAD=true

---
# ==========================================
# scripts/env-setup.sh - Environment Setup Script
# ==========================================

#!/bin/bash
set -e

echo "🔧 Setting up HolidAIButler environment..."

# Function to generate random password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to generate JWT secret
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d "=+/" | cut -c1-64
}

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    
    # Generate secure passwords
    MONGO_PASSWORD=$(generate_password)
    REDIS_PASSWORD=$(generate_password)
    JWT_SECRET=$(generate_jwt_secret)
    SESSION_SECRET=$(generate_jwt_secret)
    
    # Replace placeholders with generated values
    sed -i "s/MONGO_ROOT_PASSWORD=password123/MONGO_ROOT_PASSWORD=$MONGO_PASSWORD/" .env
    sed -i "s/REDIS_PASSWORD=redis123/REDIS_PASSWORD=$REDIS_PASSWORD/" .env
    sed -i "s/JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars/JWT_SECRET=$JWT_SECRET/" .env
    sed -i "s/SESSION_SECRET=your-session-secret-change-in-production/SESSION_SECRET=$SESSION_SECRET/" .env
    
    echo "✅ Generated secure passwords and secrets"
fi

# Create frontend .env
if [ ! -f frontend/.env ]; then
    echo "📝 Creating frontend .env file..."
    cp frontend/.env.example frontend/.env
fi

# Create docker .env
if [ ! -f docker/.env.docker ]; then
    echo "📝 Creating docker .env file..."
    cp docker/.env.docker.example docker/.env.docker
fi

echo "🔑 Environment setup complete!"
echo ""
echo "⚠️  Important next steps:"
echo "1. Update .env with your actual API keys:"
echo "   - CLAUDE_API_KEY"
echo "   - STRIPE_SECRET_KEY"
echo "   - GOOGLE_MAPS_API_KEY"
echo "   - EMAIL_* settings"
echo ""
echo "2. Update frontend/.env with your keys:"
echo "   - EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
echo "   - EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"
echo ""
echo "3. For production, use environment variables instead of .env files"

---
# ==========================================
# scripts/env-validate.sh - Environment Validation
# ==========================================

#!/bin/bash
set -e

echo "✅ Validating environment configuration..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Run: cp .env.example .env"
    exit 1
fi

# Source environment variables
source .env

# Required variables
REQUIRED_VARS=(
    "NODE_ENV"
    "PORT"
    "MONGODB_URI"
    "REDIS_URL"
    "JWT_SECRET"
)

# Optional but important variables
IMPORTANT_VARS=(
    "CLAUDE_API_KEY"
    "STRIPE_SECRET_KEY"
    "GOOGLE_MAPS_API_KEY"
    "EMAIL_HOST"
)

# Check required variables
echo "🔍 Checking required variables..."
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required variable $var is not set"
        exit 1
    else
        echo "✅ $var is set"
    fi
done

# Check important variables
echo "🔍 Checking important variables..."
for var in "${IMPORTANT_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "⚠️  Important variable $var is not set"
    else
        echo "✅ $var is set"
    fi
done

# Validate JWT secret length
if [ ${#JWT_SECRET} -lt 32 ]; then
    echo "❌ JWT_SECRET should be at least 32 characters long"
    exit 1
fi

# Validate MongoDB URI format
if [[ ! $MONGODB_URI =~ ^mongodb:// ]]; then
    echo "❌ MONGODB_URI should start with mongodb://"
    exit 1
fi

# Validate Redis URL format
if [[ ! $REDIS_URL =~ ^redis:// ]]; then
    echo "❌ REDIS_URL should start with redis://"
    exit 1
fi

echo "✅ Environment validation complete!"

---
# ==========================================
# Configuration Summary Template
# ==========================================
# config/env-summary.md

# Environment Configuration Summary

## 🔑 Required API Keys

| Service | Environment Variable | Required | Description |
|---------|---------------------|----------|-------------|
| Claude AI | `CLAUDE_API_KEY` | Yes | Anthropic Claude API key |
| Stripe | `STRIPE_SECRET_KEY` | Yes | Payment processing |
| Google Maps | `GOOGLE_MAPS_API_KEY` | Yes | Maps and places |
| Email | `EMAIL_*` | Yes | SMTP configuration |

## 🗄️ Database Configuration

| Component | Variable | Default | Description |
|-----------|----------|---------|-------------|
| MongoDB | `MONGODB_URI` | localhost:27017 | Database connection |
| Redis | `REDIS_URL` | localhost:6379 | Cache and sessions |

## 🔒 Security Settings

| Setting | Variable | Default | Description |
|---------|----------|---------|-------------|
| JWT Secret | `JWT_SECRET` | Generated | Token signing key |
| Session Secret | `SESSION_SECRET` | Generated | Session encryption |
| Rate Limiting | `RATE_LIMIT_*` | 100/15min | API rate limits |

## 🌍 Environment Specific

### Development
- Debug logging enabled
- Hot reload active
- Test API keys
- Local database

### Production
- Secure headers enabled
- Error tracking active
- Production API keys
- Remote database

### Testing
- Mock services
- Test database
- Minimal logging
- Fast timeouts

## 📱 Frontend Configuration

| Setting | Variable | Description |
|---------|----------|-------------|
| API URL | `API_BASE_URL` | Backend API endpoint |
| Maps | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps integration |
| Payments | `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe public key |

## 🚀 Quick Setup

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```

2. Run setup script:
   ```bash
   chmod +x scripts/env-setup.sh
   ./scripts/env-setup.sh
   ```

3. Validate configuration:
   ```bash
   chmod +x scripts/env-validate.sh
   ./scripts/env-validate.sh
   ```

4. Update with your API keys and run:
   ```bash
   docker-compose up -d
   ```