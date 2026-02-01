# Concierge-AI Backend

[![CI](https://github.com/damlalper/concierge-ai-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/damlalper/concierge-ai-backend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Akıllı PMS Entegrasyon ve Misafir Asistanı Platformu - Backend API

## 🚀 Özellikler

- **Webhook Ingestion**: Booking.com, Airbnb, Expedia gibi platformlardan gelen webhook'ları idempotent şekilde işleme
- **Asenkron İşleme**: BullMQ ile queue-based processing, retry mekanizması
- **AI/RAG Engine**: OpenAI ile context-aware cevap üretimi, vector similarity search (pgvector)
- **Realtime Chat**: Socket.io ile düşük latency chat deneyimi (<200ms)
- **Knowledge Management**: PDF, Markdown, Text formatında bilgi yükleme ve yönetimi
- **Multi-Database**: PostgreSQL (transactional data) + MongoDB (audit logs)
- **Authentication**: JWT-based auth + OAuth (Google) desteği
- **Supabase Integration**: Supabase client ile veri yönetimi
- **Pagination**: Standart pagination utilities
- **CI/CD**: GitHub Actions ile otomatik test ve build

## 📋 Gereksinimler

- Node.js 20+
- PostgreSQL 15+
- MongoDB 7+
- Redis 7+
- OpenAI API Key

## 🛠️ Kurulum

### 1. Repository'yi klonlayın

```bash
git clone https://github.com/damlalper/concierge-ai-backend.git
cd concierge-ai-backend
```

### 2. Bağımlılıkları yükleyin

```bash
npm install
```

### 3. Environment değişkenlerini ayarlayın

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin ve gerekli değerleri girin.

### 4. Docker ile servisleri başlatın

```bash
docker-compose up -d
```

Bu komut PostgreSQL, MongoDB ve Redis'i başlatır.

### 5. Database migration'larını çalıştırın

```bash
npm run migration:run
```

### 6. Uygulamayı başlatın

**Development:**
```bash
npm run start:dev
```

**Production:**
```bash
npm run build
npm run start:prod
```

## 📚 API Dokümantasyonu

Uygulama başladıktan sonra Swagger dokümantasyonuna erişebilirsiniz:

```
http://localhost:3000/api/docs
```

## 🏗️ Proje Yapısı

```
src/
├── main.ts                 # Application entry point
├── app.module.ts          # Root module
├── config/                # Configuration service
├── common/                # Shared utilities, decorators, interceptors
├── database/              # Database entities and schemas
│   ├── entities/          # TypeORM entities (PostgreSQL)
│   └── schemas/           # Mongoose schemas (MongoDB)
└── modules/               # Feature modules
    ├── webhook/           # Webhook ingestion
    ├── processing/        # Queue processing workers
    ├── ai/                # AI/RAG service
    ├── chat/              # Realtime chat gateway
    ├── knowledge/        # Knowledge management
    └── auth/              # Authentication & Authorization
```

## 🔌 API Endpoints

### Webhook

- `POST /api/v1/webhook/booking` - Booking webhook ingestion
- `POST /api/v1/webhook/pms` - PMS webhook ingestion

### Chat

- WebSocket: `ws://localhost:3000/guest`
- Events:
  - `guest:message` - Send message
  - `assistant:response` - Receive response
  - `assistant:typing` - Typing indicator

### Knowledge

- `POST /api/v1/knowledge/ingest` - Ingest knowledge content
- `GET /api/v1/knowledge/:hotelId` - Get knowledge chunks
- `DELETE /api/v1/knowledge/:chunkId` - Delete knowledge chunk

### Authentication

- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/profile` - Get current user profile (requires JWT)
- `GET /api/v1/auth/oauth/google` - Initiate Google OAuth
- `GET /api/v1/auth/oauth/google/callback` - Google OAuth callback

### Health

- `GET /api/v1/health` - Health check
- `GET /api/v1/health/ready` - Readiness probe
- `GET /api/v1/health/live` - Liveness probe

## 🔐 Güvenlik

- **Webhook Security**: HMAC-SHA256 signature validation, timestamp validation
- **Authentication**: JWT tokens (15min access, 7day refresh), OAuth 2.0 support
- **Rate Limiting**: 100 req/min per endpoint (configurable)
- **Input Validation**: class-validator with DTOs
- **CORS**: Configurable CORS policies
- **Security Headers**: Helmet.js integration
- **RBAC**: Role-based access control (guest, hotel_staff, admin, system)

## 🧪 Test

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# Coverage report
npm run test:cov

# Debug tests
npm run test:debug
```

Test coverage includes:
- Unit tests for services (WebhookService, AiService, etc.)
- Integration tests for queue processing
- Mock AI responses for testing

## 📊 Monitoring & Observability

- **Structured Logging**: Winston logger with correlation IDs
- **Health Checks**: Database, Redis, MongoDB status monitoring
- **Metrics**: Ready for Prometheus integration
- **Error Tracking**: Sentry integration ready
- **Distributed Tracing**: OpenTelemetry support (ready for implementation)
- **Request Tracking**: Correlation IDs for end-to-end request tracing

## 🚢 Deployment

### Docker

```bash
docker build -t concierge-ai-backend .
docker run -p 3000:3000 --env-file .env concierge-ai-backend
```

### Environment Variables

Tüm gerekli environment değişkenleri `.env.example` dosyasında listelenmiştir.

**Önemli Değişkenler:**
- `DATABASE_URL`: PostgreSQL connection string
- `MONGODB_URL`: MongoDB connection string
- `REDIS_HOST`, `REDIS_PORT`: Redis configuration
- `OPENAI_API_KEY`: OpenAI API key for RAG
- `JWT_SECRET`: JWT signing secret
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`: Supabase configuration
- `WEBHOOK_SECRET_*`: Webhook signature secrets

## 🛠️ Teknoloji Stack

- **Framework**: NestJS 10+ (TypeScript)
- **Databases**: PostgreSQL 15+ (TypeORM), MongoDB 7+ (Mongoose)
- **Queue**: BullMQ + Redis
- **AI**: OpenAI API (GPT-4, Embeddings)
- **Vector Search**: pgvector extension
- **Realtime**: Socket.io
- **Auth**: JWT, Passport.js, OAuth 2.0
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest
- **CI/CD**: GitHub Actions

## 📈 Backend Developer Features

Bu proje aşağıdaki backend developer gereksinimlerini karşılar:

✅ NestJS tabanlı servis ve API geliştirme  
✅ Supabase/Postgres ile veri modelleme ve optimizasyon  
✅ PMS entegrasyonları ve üçüncü parti servisler  
✅ OpenAI/LLM API entegrasyonları, embedding ve vector search  
✅ Performans, güvenlik, hata ayıklama optimizasyonu  
✅ Realtime akışlar (WebSocket/Socket.io)  
✅ TypeScript + Node.js deneyimi  
✅ REST API tasarımı ve backend mimarisi  
✅ SQL (Postgres) ve veri modelleme  
✅ OpenAI/LLM kullanımı (prompt, embedding, RAG)  
✅ Temiz kod, test alışkanlığı  
✅ Supabase tecrübesi  
✅ Vector DB / pgvector / semantic search  
✅ OAuth / üçüncü parti API entegrasyonları  
✅ Webhook/event tabanlı akışlar, retry/backoff, idempotent işlemler  
✅ Loglama/izleme, performans iyileştirmeleri  
✅ Veri eşleme, senkronizasyon  
✅ Asenkron çalışma, kuyruk mantığı  
✅ Git ve CI/CD yaklaşımı

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


## 🔗 Links

- [Repository](https://github.com/damlalper/concierge-ai-backend)
- [PRD Document](PRD.md)


