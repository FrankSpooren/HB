# HolidAIButler Production Deployment

## 🚀 CI/CD Pipelines

### GitHub Actions Workflow

**`.github/workflows/ci-cd.yml`**
```yaml
name: HolidAIButler CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  PYTHON_VERSION: '3.11'
  DOCKER_REGISTRY: 'your-registry.azurecr.io'
  
jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: holidaibutler_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ env.PYTHON_VERSION }}
    
    - name: Install dependencies
      run: |
        npm ci
        pip install -r requirements.txt
    
    - name: Run linting
      run: |
        npm run lint
        flake8 backend/
        black --check backend/
    
    - name: Run tests
      run: |
        npm test -- --coverage
        pytest backend/tests/ --cov=backend --cov-report=xml
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/holidaibutler_test
        REDIS_URL: redis://localhost:6379
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3

  security:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        format: 'sarif'
        output: 'trivy-results.sarif'
    
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'
    
    - name: Run npm audit
      run: npm audit --audit-level high
    
    - name: Run safety check
      run: pip install safety && safety check

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Login to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.DOCKER_REGISTRY }}
        username: ${{ secrets.REGISTRY_USERNAME }}
        password: ${{ secrets.REGISTRY_PASSWORD }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.DOCKER_REGISTRY }}/holidaibutler
        tags: |
          type=ref,event=branch
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}
    
    - name: Build and push
      id: build
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: staging
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to staging
      run: |
        ./scripts/deploy.sh staging ${{ needs.build.outputs.image-tag }}
      env:
        KUBECONFIG_DATA: ${{ secrets.STAGING_KUBECONFIG }}
        STAGING_DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}

  integration-tests:
    needs: deploy-staging
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Run integration tests
      run: |
        npm run test:integration
      env:
        STAGING_URL: ${{ secrets.STAGING_URL }}
        API_KEY: ${{ secrets.STAGING_API_KEY }}

  deploy-production:
    needs: [deploy-staging, integration-tests]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to production
      run: |
        ./scripts/deploy.sh production ${{ needs.build.outputs.image-tag }}
      env:
        KUBECONFIG_DATA: ${{ secrets.PRODUCTION_KUBECONFIG }}
        PRODUCTION_DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
    
    - name: Run smoke tests
      run: |
        ./scripts/smoke-tests.sh
      env:
        PRODUCTION_URL: ${{ secrets.PRODUCTION_URL }}

  rollback:
    runs-on: ubuntu-latest
    if: failure()
    environment: production
    
    steps:
    - name: Rollback production
      run: |
        ./scripts/rollback.sh
      env:
        KUBECONFIG_DATA: ${{ secrets.PRODUCTION_KUBECONFIG }}
```

### Deployment Scripts

**`scripts/deploy.sh`**
```bash
#!/bin/bash
set -euo pipefail

ENVIRONMENT=$1
IMAGE_TAG=$2

echo "🚀 Deploying HolidAIButler to $ENVIRONMENT"
echo "📦 Image: $IMAGE_TAG"

# Setup kubectl
echo "$KUBECONFIG_DATA" | base64 -d > /tmp/kubeconfig
export KUBECONFIG=/tmp/kubeconfig

# Update image in deployment
kubectl set image deployment/holidaibutler-api \
  holidaibutler-api="$IMAGE_TAG" \
  -n "holidaibutler-$ENVIRONMENT"

# Wait for rollout
kubectl rollout status deployment/holidaibutler-api \
  -n "holidaibutler-$ENVIRONMENT" \
  --timeout=600s

# Update frontend deployment
kubectl set image deployment/holidaibutler-frontend \
  holidaibutler-frontend="$IMAGE_TAG" \
  -n "holidaibutler-$ENVIRONMENT"

kubectl rollout status deployment/holidaibutler-frontend \
  -n "holidaibutler-$ENVIRONMENT" \
  --timeout=600s

echo "✅ Deployment completed successfully"
```

**`scripts/rollback.sh`**
```bash
#!/bin/bash
set -euo pipefail

echo "🔄 Rolling back HolidAIButler production deployment"

# Setup kubectl
echo "$KUBECONFIG_DATA" | base64 -d > /tmp/kubeconfig
export KUBECONFIG=/tmp/kubeconfig

# Rollback API
kubectl rollout undo deployment/holidaibutler-api \
  -n holidaibutler-production

# Rollback Frontend
kubectl rollout undo deployment/holidaibutler-frontend \
  -n holidaibutler-production

# Wait for rollback completion
kubectl rollout status deployment/holidaibutler-api \
  -n holidaibutler-production \
  --timeout=300s

kubectl rollout status deployment/holidaibutler-frontend \
  -n holidaibutler-production \
  --timeout=300s

echo "✅ Rollback completed successfully"
```

## 📊 Monitoring Stack

### Prometheus Configuration

**`monitoring/prometheus.yml`**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'holidaibutler-api'
    static_configs:
      - targets: ['holidaibutler-api:8000']
    metrics_path: /metrics
    scrape_interval: 10s

  - job_name: 'holidaibutler-frontend'
    static_configs:
      - targets: ['holidaibutler-frontend:3000']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']
```

### Grafana Dashboard Configuration

**`monitoring/grafana/dashboards/holidaibutler-overview.json`**
```json
{
  "dashboard": {
    "id": null,
    "title": "HolidAIButler Platform Overview",
    "tags": ["holidaibutler", "production"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"holidaibutler-api\"}[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{job=\"holidaibutler-api\"}[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "id": 2,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"holidaibutler-api\"}[5m])",
            "legendFormat": "{{method}} {{status_code}}"
          }
        ]
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"holidaibutler-api\",status_code=~\"5..\"}[5m]) / rate(http_requests_total{job=\"holidaibutler-api\"}[5m]) * 100"
          }
        ]
      },
      {
        "id": 4,
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "increase(user_sessions_total[1h])"
          }
        ]
      },
      {
        "id": 5,
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends{datname=\"holidaibutler\"}"
          }
        ]
      },
      {
        "id": 6,
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "process_resident_memory_bytes{job=\"holidaibutler-api\"}"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

### Alert Rules

**`monitoring/rules/holidaibutler.yml`**
```yaml
groups:
- name: holidaibutler.rules
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{job="holidaibutler-api",status_code=~"5.."}[5m]) / rate(http_requests_total{job="holidaibutler-api"}[5m]) * 100 > 5
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }}% for the last 5 minutes"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="holidaibutler-api"}[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }}s"

  - alert: DatabaseDown
    expr: up{job="postgres"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database is down"
      description: "PostgreSQL database is not responding"

  - alert: HighMemoryUsage
    expr: process_resident_memory_bytes{job="holidaibutler-api"} / 1024 / 1024 / 1024 > 2
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage"
      description: "Memory usage is {{ $value }}GB"

  - alert: LowDiskSpace
    expr: (node_filesystem_size_bytes{mountpoint="/"} - node_filesystem_free_bytes{mountpoint="/"}) / node_filesystem_size_bytes{mountpoint="/"} * 100 > 85
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Low disk space"
      description: "Disk usage is {{ $value }}%"
```

### ELK Stack Configuration

**`monitoring/logstash/pipeline/holidaibutler.conf`**
```ruby
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "holidaibutler-api" {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{DATA:logger} - %{GREEDYDATA:message}" }
    }
    
    date {
      match => [ "timestamp", "ISO8601" ]
    }
    
    if [message] =~ /HTTP/ {
      grok {
        match => { "message" => "HTTP %{WORD:method} %{URIPATH:path} %{NUMBER:status_code:int} %{NUMBER:response_time:float}ms" }
      }
    }
  }
  
  if [fields][service] == "holidaibutler-frontend" {
    if [message] =~ /nginx/ {
      grok {
        match => { "message" => "%{IPORHOST:clientip} - - \[%{HTTPDATE:timestamp}\] \"%{WORD:method} %{URIPATH:path} HTTP/%{NUMBER:httpversion}\" %{NUMBER:status_code:int} %{NUMBER:bytes:int}" }
      }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "holidaibutler-%{+YYYY.MM.dd}"
  }
}
```

## 📚 Production Documentation

### API Documentation (OpenAPI)

**`docs/api-spec.yml`**
```yaml
openapi: 3.0.3
info:
  title: HolidAIButler API
  version: 1.0.0
  description: AI-powered holiday planning platform API
  contact:
    name: HolidAIButler Team
    email: api@holidaibutler.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.holidaibutler.com/v1
    description: Production server
  - url: https://staging-api.holidaibutler.com/v1
    description: Staging server

security:
  - bearerAuth: []

paths:
  /auth/login:
    post:
      summary: User authentication
      tags: [Authentication]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
              required: [email, password]
      responses:
        '200':
          description: Successful authentication
          content:
            application/json:
              schema:
                type: object
                properties:
                  access_token:
                    type: string
                  refresh_token:
                    type: string
                  expires_in:
                    type: integer
        '401':
          $ref: '#/components/responses/Unauthorized'

  /trips:
    get:
      summary: Get user trips
      tags: [Trips]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [draft, confirmed, completed]
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: offset
          in: query
          schema:
            type: integer
            minimum: 0
            default: 0
      responses:
        '200':
          description: List of trips
          content:
            application/json:
              schema:
                type: object
                properties:
                  trips:
                    type: array
                    items:
                      $ref: '#/components/schemas/Trip'
                  total:
                    type: integer
                  limit:
                    type: integer
                  offset:
                    type: integer

    post:
      summary: Create new trip
      tags: [Trips]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTripRequest'
      responses:
        '201':
          description: Trip created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Trip'
        '400':
          $ref: '#/components/responses/BadRequest'

  /trips/{tripId}/ai-suggestions:
    post:
      summary: Get AI travel suggestions
      tags: [AI Features]
      parameters:
        - name: tripId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                preferences:
                  type: object
                  properties:
                    budget:
                      type: number
                    interests:
                      type: array
                      items:
                        type: string
                    travel_style:
                      type: string
                      enum: [budget, mid-range, luxury]
      responses:
        '200':
          description: AI suggestions generated
          content:
            application/json:
              schema:
                type: object
                properties:
                  suggestions:
                    type: array
                    items:
                      $ref: '#/components/schemas/Suggestion'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Trip:
      type: object
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
        destination:
          type: string
        start_date:
          type: string
          format: date
        end_date:
          type: string
          format: date
        status:
          type: string
          enum: [draft, confirmed, completed]
        budget:
          type: number
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    CreateTripRequest:
      type: object
      required: [title, destination, start_date, end_date]
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 200
        destination:
          type: string
          minLength: 1
        start_date:
          type: string
          format: date
        end_date:
          type: string
          format: date
        budget:
          type: number
          minimum: 0

    Suggestion:
      type: object
      properties:
        id:
          type: string
        type:
          type: string
          enum: [accommodation, activity, restaurant, transport]
        title:
          type: string
        description:
          type: string
        price:
          type: number
        rating:
          type: number
          minimum: 0
          maximum: 5

  responses:
    BadRequest:
      description: Bad request
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
              details:
                type: object

    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: "Invalid or expired token"

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: "Resource not found"
```

### Deployment Guide

**`docs/deployment-guide.md`**
```markdown
# HolidAIButler Deployment Guide

## Prerequisites

- Kubernetes cluster (v1.24+)
- Docker registry access
- Terraform (v1.0+)
- kubectl configured
- Helm (v3.0+)

## Infrastructure Setup

### 1. Provision Infrastructure with Terraform

```bash
cd infrastructure/terraform
terraform init
terraform plan -var-file="production.tfvars"
terraform apply
```

### 2. Install Required Operators

```bash
# Install NGINX Ingress Controller
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# Install cert-manager for SSL
helm upgrade --install cert-manager cert-manager \
  --repo https://charts.jetstack.io \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true
```

### 3. Configure Secrets

```bash
# Database credentials
kubectl create secret generic db-credentials \
  --from-literal=username=holidaibutler \
  --from-literal=password=<secure-password> \
  --namespace holidaibutler-production

# API keys
kubectl create secret generic api-keys \
  --from-literal=openai-key=<openai-key> \
  --from-literal=jwt-secret=<jwt-secret> \
  --namespace holidaibutler-production
```

## Application Deployment

### 1. Deploy Database

```bash
helm upgrade --install postgresql postgresql \
  --repo https://charts.bitnami.com/bitnami \
  --namespace holidaibutler-production \
  --values values/postgresql.yml
```

### 2. Deploy Application

```bash
# Deploy API
kubectl apply -f k8s/api/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress/
```

### 3. Run Database Migrations

```bash
kubectl exec -it deployment/holidaibutler-api \
  --namespace holidaibutler-production -- \
  python manage.py migrate
```

## Verification

### Health Checks

```bash
# Check pods
kubectl get pods -n holidaibutler-production

# Check services
kubectl get svc -n holidaibutler-production

# Check ingress
kubectl get ingress -n holidaibutler-production
```

### Smoke Tests

```bash
# Test API health
curl https://api.holidaibutler.com/health

# Test frontend
curl https://holidaibutler.com
```
```

### Troubleshooting Playbook

**`docs/troubleshooting.md`**
```markdown
# HolidAIButler Troubleshooting Playbook

## Common Issues

### 🔴 High Error Rate Alert

**Symptoms:**
- Error rate > 5% for 5+ minutes
- Users reporting 500 errors

**Investigation Steps:**
1. Check application logs:
   ```bash
   kubectl logs -f deployment/holidaibutler-api -n holidaibutler-production
   ```

2. Check database connectivity:
   ```bash
   kubectl exec -it deployment/holidaibutler-api -n holidaibutler-production -- \
     python -c "import psycopg2; psycopg2.connect('$DATABASE_URL')"
   ```

3. Check external API status:
   ```bash
   curl -I https://api.openai.com/v1/models
   ```

**Resolution:**
- If database issue: Scale database or check connections
- If external API issue: Implement circuit breaker
- If code issue: Deploy hotfix or rollback

### 🟡 High Response Time

**Symptoms:**
- 95th percentile > 2 seconds
- Users reporting slow performance

**Investigation Steps:**
1. Check database performance:
   ```sql
   SELECT * FROM pg_stat_activity WHERE state = 'active';
   SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
   ```

2. Check memory usage:
   ```bash
   kubectl top pods -n holidaibutler-production
   ```

3. Check slow queries in logs:
   ```bash
   kubectl logs deployment/holidaibutler-api -n holidaibutler-production | grep "slow query"
   ```

**Resolution:**
- Scale pods horizontally
- Optimize slow queries
- Add database indexes
- Implement caching

### 🔴 Database Down

**Symptoms:**
- Database connectivity alerts
- Application cannot connect to DB

**Investigation Steps:**
1. Check database pod status:
   ```bash
   kubectl get pods -l app=postgresql -n holidaibutler-production
   ```

2. Check database logs:
   ```bash
   kubectl logs -l app=postgresql -n holidaibutler-production
   ```

3. Check storage:
   ```bash
   kubectl get pvc -n holidaibutler-production
   ```

**Resolution:**
1. If pod crashed: Restart database pod
2. If storage full: Expand PVC or cleanup old data
3. If corruption: Restore from backup

### 🟡 High Memory Usage

**Symptoms:**
- Memory usage > 2GB for 10+ minutes
- Potential memory leaks

**Investigation Steps:**
1. Check memory metrics:
   ```bash
   kubectl top pods -n holidaibutler-production
   ```

2. Get detailed memory breakdown:
   ```bash
   kubectl exec -it deployment/holidaibutler-api -n holidaibutler-production -- \
     cat /proc/meminfo
   ```

**Resolution:**
1. Restart affected pods
2. Scale horizontally
3. Investigate memory leaks in code

## Escalation Procedures

### Severity Levels

**Critical (P0):**
- Platform completely down
- Data loss or corruption
- Security breach

**High (P1):**
- Core features unavailable
- Performance severely degraded
- High error rates

**Medium (P2):**
- Non-core features affected
- Moderate performance issues

**Low (P3):**
- Minor issues
- Enhancement requests

### Contact Information

- **On-call Engineer:** +31-XX-XXX-XXXX
- **Engineering Manager:** engineering-manager@holidaibutler.com
- **DevOps Team:** devops@holidaibutler.com
- **Security Team:** security@holidaibutler.com

### Escalation Timeline

- **P0:** Immediate escalation
- **P1:** Escalate after 30 minutes
- **P2:** Escalate after 2 hours
- **P3:** Escalate next business day
```

## 🔒 Security Hardening

### SSL/TLS Configuration

**`k8s/ingress/tls-ingress.yml`**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: holidaibutler-ingress
  namespace: holidaibutler-production
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
    nginx.ingress.kubernetes.io/ssl-ciphers: "ECDHE-RSA-AES128-GCM-SHA256,ECDHE-RSA-AES256-GCM-SHA384"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-Frame-Options "DENY" always;
      add_header X-XSS-Protection "1; mode=block" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;
spec:
  tls:
  - hosts:
    - holidaibutler.com
    - api.holidaibutler.com
    secretName: holidaibutler-tls
  rules:
  - host: holidaibutler.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: holidaibutler-frontend
            port:
              number: 80
  - host: api.holidaibutler.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: holidaibutler-api
            port:
              number: 8000
```

### Rate Limiting Configuration

**`k8s/middleware/rate-limit.yml`**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-rate-limit
  namespace: holidaibutler-production
data:
  rate-limit.conf: |
    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_req_zone $binary_remote_addr zone=general:10m rate=20r/s;
    
    # Apply rate limits
    location /api/auth/login {
        limit_req zone=login burst=10 nodelay;
        limit_req_status 429;
    }
    
    location /api/ {
        limit_req zone=api burst=200 nodelay;
        limit_req_status 429;
    }
    
    location / {
        limit_req zone=general burst=50 nodelay;
        limit_req_status 429;
    }
```

### Network Policies

**`k8s/security/network-policy.yml`**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: holidaibutler-network-policy
  namespace: holidaibutler-production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8000
    - protocol: TCP
      port: 3000
  
  - from:
    - podSelector:
        matchLabels:
          app: holidaibutler-api
    to:
    - podSelector:
        matchLabels:
          app: postgresql
    ports:
    - protocol: TCP
      port: 5432
  
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 443  # HTTPS
    - protocol: TCP
      port: 53   # DNS
    - protocol: UDP
      port: 53   # DNS
```

### Security Scanning Pipeline

**`security/scan-config.yml`**
```yaml
# Container security scanning
apiVersion: v1
kind: ConfigMap
metadata:
  name: security-scan-config
data:
  trivy-config.yaml: |
    # Trivy configuration
    severity:
      - CRITICAL
      - HIGH
      - MEDIUM
    
    ignore-unfixed: true
    
    vulnerability:
      type:
        - os
        - library
    
    secret:
      config: |
        rules:
          - id: generic-password
            pattern: password\s*=\s*['"]([^'"]+)['"]
          - id: api-key
            pattern: api[_-]?key\s*=\s*['"]([^'"]+)['"]
```

## 🏗️ Infrastructure as Code

### Terraform Configuration

**`infrastructure/terraform/main.tf`**
```hcl
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
  
  backend "azurerm" {
    resource_group_name  = "holidaibutler-tfstate"
    storage_account_name = "holidaibutlertfstate"
    container_name       = "tfstate"
    key                  = "production.terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "holidaibutler-${var.environment}"
  location = var.location
  
  tags = {
    Environment = var.environment
    Project     = "HolidAIButler"
  }
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "main" {
  name                = "holidaibutler-aks-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "holidaibutler-${var.environment}"
  
  default_node_pool {
    name                = "default"
    node_count          = var.node_count
    vm_size            = var.vm_size
    type               = "VirtualMachineScaleSets"
    availability_zones = ["1", "2", "3"]
    
    upgrade_settings {
      max_surge = "33%"
    }
  }
  
  identity {
    type = "SystemAssigned"
  }
  
  network_profile {
    network_plugin    = "kubenet"
    load_balancer_sku = "standard"
  }
  
  auto_scaler_profile {
    balance_similar_node_groups = true
    max_graceful_termination_sec = 600
    scale_down_delay_after_add = "10m"
    scale_down_unneeded = "10m"
  }
  
  tags = {
    Environment = var.environment
  }
}

# PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "holidaibutler-postgres-${var.environment}"
  resource_group_name    = azurerm_resource_group.main.name
  location              = azurerm_resource_group.main.location
  
  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password
  
  backup_retention_days = 7
  
  sku_name = var.db_sku_name
  version  = "14"
  
  zone = "1"
  
  high_availability {
    mode = "ZoneRedundant"
  }
  
  tags = {
    Environment = var.environment
  }
}

# Container Registry
resource "azurerm_container_registry" "main" {
  name                = "holidaibutlerregistry${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location           = azurerm_resource_group.main.location
  sku                = "Premium"
  admin_enabled      = true
  
  retention_policy {
    days    = 7
    enabled = true
  }
  
  trust_policy {
    enabled = true
  }
  
  tags = {
    Environment = var.environment
  }
}

# Redis Cache
resource "azurerm_redis_cache" "main" {
  name                = "holidaibutler-redis-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  capacity            = 2
  family              = "C"
  sku_name            = "Standard"
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"
  
  redis_configuration {
    maxmemory_reserved = 125
    maxmemory_delta    = 125
    maxmemory_policy   = "allkeys-lru"
  }
  
  tags = {
    Environment = var.environment
  }
}

# Application Insights
resource "azurerm_application_insights" "main" {
  name                = "holidaibutler-insights-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "web"
  
  tags = {
    Environment = var.environment
  }
}

# Key Vault
resource "azurerm_key_vault" "main" {
  name                = "holidaibutler-kv-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
  
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id
    
    key_permissions = [
      "Create", "Get", "List", "Update", "Delete"
    ]
    
    secret_permissions = [
      "Set", "Get", "List", "Delete"
    ]
  }
  
  tags = {
    Environment = var.environment
  }
}

data "azurerm_client_config" "current" {}
```

**`infrastructure/terraform/variables.tf`**
```hcl
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "West Europe"
}

variable "node_count" {
  description = "Number of AKS nodes"
  type        = number
  default     = 3
}

variable "vm_size" {
  description = "Size of AKS VMs"
  type        = string
  default     = "Standard_D2s_v3"
}

variable "db_admin_username" {
  description = "Database administrator username"
  type        = string
  default     = "holidaibutler"
}

variable "db_admin_password" {
  description = "Database administrator password"
  type        = string
  sensitive   = true
}

variable "db_sku_name" {
  description = "Database SKU"
  type        = string
  default     = "GP_Standard_D2s_v3"
}
```

## 🔄 Disaster Recovery

### Backup Strategy

**`scripts/backup.sh`**
```bash
#!/bin/bash
set -euo pipefail

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_BUCKET="holidaibutler-backups"
POSTGRES_HOST="holidaibutler-postgres-production.postgres.database.azure.com"

echo "🔄 Starting backup process: $BACKUP_DATE"

# Database backup
echo "📊 Backing up database..."
pg_dump -h "$POSTGRES_HOST" \
        -U holidaibutler \
        -d holidaibutler \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        | gzip > "db_backup_$BACKUP_DATE.sql.gz"

# Upload to Azure Blob Storage
echo "☁️ Uploading to cloud storage..."
az storage blob upload \
  --account-name holidaibutlerbackups \
  --container-name database \
  --name "db_backup_$BACKUP_DATE.sql.gz" \
  --file "db_backup_$BACKUP_DATE.sql.gz"

# File storage backup
echo "📁 Backing up file storage..."
az storage blob sync \
  --account-name holidaibutlerstorage \
  --container uploads \
  --destination-container "backups/uploads_$BACKUP_DATE"

# Kubernetes configuration backup
echo "⚙️ Backing up Kubernetes configs..."
kubectl get all,configmap,secret,pvc,ingress \
  --namespace holidaibutler-production \
  -o yaml > "k8s_backup_$BACKUP_DATE.yml"

az storage blob upload \
  --account-name holidaibutlerbackups \
  --container-name kubernetes \
  --name "k8s_backup_$BACKUP_DATE.yml" \
  --file "k8s_backup_$BACKUP_DATE.yml"

# Cleanup local files
rm -f "db_backup_$BACKUP_DATE.sql.gz"
rm -f "k8s_backup_$BACKUP_DATE.yml"

# Cleanup old backups (keep 30 days)
echo "🧹 Cleaning up old backups..."
CUTOFF_DATE=$(date -d '30 days ago' +%Y%m%d)

az storage blob list \
  --account-name holidaibutlerbackups \
  --container-name database \
  --query "[?properties.lastModified < '$CUTOFF_DATE'].name" \
  --output tsv | \
  xargs -I {} az storage blob delete \
    --account-name holidaibutlerbackups \
    --container-name database \
    --name {}

echo "✅ Backup completed: $BACKUP_DATE"
```

### Recovery Procedures

**`scripts/restore.sh`**
```bash
#!/bin/bash
set -euo pipefail

BACKUP_DATE=$1
POSTGRES_HOST="holidaibutler-postgres-production.postgres.database.azure.com"

if [ -z "$BACKUP_DATE" ]; then
  echo "Usage: $0 <backup_date>"
  echo "Example: $0 20240315_140000"
  exit 1
fi

echo "🔄 Starting recovery process for backup: $BACKUP_DATE"

# Download database backup
echo "📥 Downloading database backup..."
az storage blob download \
  --account-name holidaibutlerbackups \
  --container-name database \
  --name "db_backup_$BACKUP_DATE.sql.gz" \
  --file "db_backup_$BACKUP_DATE.sql.gz"

# Restore database
echo "📊 Restoring database..."
echo "⚠️  This will overwrite the current database!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" = "yes" ]; then
  gunzip -c "db_backup_$BACKUP_DATE.sql.gz" | \
    psql -h "$POSTGRES_HOST" \
         -U holidaibutler \
         -d holidaibutler \
         --verbose
  
  echo "✅ Database restored successfully"
else
  echo "❌ Recovery cancelled"
  exit 1
fi

# Cleanup
rm -f "db_backup_$BACKUP_DATE.sql.gz"

echo "✅ Recovery completed for backup: $BACKUP_DATE"
```

## 📈 Scaling Strategies

### Horizontal Pod Autoscaler

**`k8s/autoscaling/hpa.yml`**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: holidaibutler-api-hpa
  namespace: holidaibutler-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: holidaibutler-api
  
  minReplicas: 3
  maxReplicas: 20
  
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Max
```

### Cluster Autoscaler

**`k8s/autoscaling/cluster-autoscaler.yml`**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cluster-autoscaler
  template:
    metadata:
      labels:
        app: cluster-autoscaler
    spec:
      serviceAccountName: cluster-autoscaler
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.21.0
        name: cluster-autoscaler
        resources:
          limits:
            cpu: 100m
            memory: 300Mi
          requests:
            cpu: 100m
            memory: 300Mi
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=azure
        - --skip-nodes-with-local-storage=false
        - --expander=random
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/holidaibutler-aks-production
        - --balance-similar-node-groups
        - --scale-down-delay-after-add=10m
        - --scale-down-unneeded-time=10m
        env:
        - name: ARM_SUBSCRIPTION_ID
          valueFrom:
            secretKeyRef:
              key: SubscriptionID
              name: cluster-autoscaler-azure
        - name: ARM_RESOURCE_GROUP
          valueFrom:
            secretKeyRef:
              key: ResourceGroup
              name: cluster-autoscaler-azure
        - name: ARM_TENANT_ID
          valueFrom:
            secretKeyRef:
              key: TenantID
              name: cluster-autoscaler-azure
        - name: ARM_CLIENT_ID
          valueFrom:
            secretKeyRef:
              key: ClientID
              name: cluster-autoscaler-azure
        - name: ARM_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              key: ClientSecret
              name: cluster-autoscaler-azure
```

## ✅ Production Checklist

### Pre-Launch Checklist

#### Infrastructure
- [ ] Kubernetes cluster configured and healthy
- [ ] Database deployed with high availability
- [ ] Redis cache configured
- [ ] Container registry set up
- [ ] DNS configured and propagated
- [ ] SSL certificates installed and valid
- [ ] Load balancer configured
- [ ] Auto-scaling configured

#### Security
- [ ] Network policies implemented
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] API authentication working
- [ ] Secrets properly managed in Key Vault
- [ ] Container images scanned for vulnerabilities
- [ ] RBAC configured
- [ ] Backup encryption enabled

#### Monitoring
- [ ] Prometheus metrics collecting
- [ ] Grafana dashboards configured
- [ ] Alert rules configured and tested
- [ ] Log aggregation working
- [ ] Uptime monitoring configured
- [ ] Error tracking enabled
- [ ] Performance monitoring active

#### Application
- [ ] Database migrations completed
- [ ] Environment variables configured
- [ ] Health checks responding
- [ ] API endpoints tested
- [ ] Frontend assets deployed
- [ ] CDN configured
- [ ] Search functionality working
- [ ] AI integration tested

#### Testing
- [ ] Unit tests passing (>90% coverage)
- [ ] Integration tests passing
- [ ] End-to-end tests passing
- [ ] Load testing completed
- [ ] Security testing completed
- [ ] Accessibility testing completed
- [ ] Cross-browser testing completed

#### Documentation
- [ ] API documentation updated
- [ ] Deployment guide complete
- [ ] Troubleshooting playbook ready
- [ ] Architecture diagrams updated
- [ ] Monitoring runbooks created
- [ ] Disaster recovery procedures documented

#### Operations
- [ ] Backup strategy implemented
- [ ] Disaster recovery tested
- [ ] On-call procedures defined
- [ ] Team trained on operations
- [ ] Support contacts updated
- [ ] Escalation procedures documented

### Post-Launch Checklist

#### Day 1
- [ ] Monitor error rates and response times
- [ ] Check all health endpoints
- [ ] Verify monitoring alerts
- [ ] Monitor user registration flows
- [ ] Check payment processing
- [ ] Verify email delivery

#### Week 1
- [ ] Review performance metrics
- [ ] Analyze user behavior
- [ ] Check resource utilization
- [ ] Review security logs
- [ ] Optimize queries if needed
- [ ] Update documentation based on issues

#### Month 1
- [ ] Conduct security review
- [ ] Optimize costs
- [ ] Review scaling patterns
- [ ] Update disaster recovery procedures
- [ ] Performance optimization
- [ ] User feedback analysis

### Emergency Contacts

- **On-call Engineer:** +31-XX-XXX-XXXX
- **DevOps Lead:** devops@holidaibutler.com
- **Engineering Manager:** eng-manager@holidaibutler.com
- **Security Team:** security@holidaibutler.com
- **Azure Support:** [Azure Portal Support]

### Quick Commands

```bash
# Check overall system health
kubectl get pods -A | grep -v Running

# Check recent deployments
kubectl rollout history deployment/holidaibutler-api -n holidaibutler-production

# Emergency rollback
kubectl rollout undo deployment/holidaibutler-api -n holidaibutler-production

# Scale up immediately
kubectl scale deployment/holidaibutler-api --replicas=10 -n holidaibutler-production

# Check logs
kubectl logs -f deployment/holidaibutler-api -n holidaibutler-production --tail=100

# Port forward for debugging
kubectl port-forward svc/holidaibutler-api 8000:8000 -n holidaibutler-production
```

---

**🎯 Next Steps:**
1. **Review and customize** all configurations for your specific environment
2. **Test thoroughly** in staging before production deployment  
3. **Train your team** on operational procedures
4. **Set up monitoring** before going live
5. **Have rollback plan ready** before deployment

This comprehensive production deployment setup ensures your HolidAIButler platform is enterprise-ready with robust monitoring, security, and operational procedures!