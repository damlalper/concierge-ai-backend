# 📘 PRD – Concierge-AI: Akıllı PMS Entegrasyon ve Misafir Asistanı Platformu (Extended / Technical)

---

## 1. Background & Context

Otelcilik sektöründe PMS (Property Management System) altyapıları; rezervasyon, misafir bilgileri, oda durumu ve faturalama gibi kritik operasyonları yönetir. Ancak modern oteller, Booking.com, Airbnb, Expedia gibi **çoklu üçüncü parti kanallar** üzerinden rezervasyon aldığı için veri senkronizasyonu ciddi bir mühendislik problemine dönüşmüştür.

Bu kanallardan gelen veriler:

* Farklı şemalara sahiptir
* Webhook tabanlı, event-driven çalışır
* Zaman zaman duplicate veya out-of-order event üretir
* PMS veya DB downtime senaryolarında **geri alınamaz veri kayıplarına** yol açabilir

Aynı zamanda misafir tarafında:

* Check-in / Check-out saatleri
* Otel kuralları
* Wi-Fi, otopark, havuz, restoran bilgileri

gibi **yüksek tekrar oranına sahip sorular**, operasyon ekibi üzerinde ciddi yük oluşturur.

Concierge-AI, bu iki problemi **tek bir ölçeklenebilir backend platformu** altında çözer.

---

## 2. Product Vision

Concierge-AI, oteller için:

* **Design-for-Failure** prensibiyle çalışan
* Event-driven, asenkron
* AI destekli
* Realtime iletişim yeteneklerine sahip

modern bir **backend platformu** sunar.

Bu ürün bir "frontend uygulama" değil; farklı istemciler (web, mobile, kiosk, WhatsApp bot vb.) tarafından tüketilebilecek **API-first bir sistemdir**.

---

## 3. Goals & Non-Goals

### 3.1 Goals

* PMS entegrasyonlarında %99.9 veri güvenliği
* Idempotent webhook ingestion
* Asenkron, retry destekli veri işleme
* Hallucination-free AI cevap üretimi
* Düşük latency realtime chat deneyimi

### 3.2 Non-Goals (MVP)

* Ödeme sistemleri
* UI/UX geliştirme
* Native mobil uygulama

---

## 4. Stakeholders

* Otel IT / Operasyon ekipleri
* PMS sağlayıcıları
* Lumin-AI backend ekibi (internal)

---

## 5. High-Level Architecture

```
[3rd Party PMS / Booking]
        |
     Webhook
        |
[NestJS Ingestion API]
        |
   MongoDB (Audit)
        |
     BullMQ
        |
[Processing Workers]
        |
 Supabase / Postgres
        |
   AI Services (RAG)
        |
   Socket.io Gateway
```

---

## 6. Tech Stack & Rationale

### 6.1 Backend

* **NestJS (TypeScript)**

  * Modüler mimari
  * Dependency Injection
  * Test edilebilirlik

### 6.2 Databases

#### PostgreSQL (Supabase)

* Strong consistency
* Relational integrity
* ACID transactions

#### MongoDB

* Write-heavy workload
* Schema-less raw payload storage
* Audit & replay capability

### 6.3 Queue & Async

* **BullMQ + Redis**
* Backpressure control
* Retry / Delay / DLQ

### 6.4 AI Stack

* OpenAI Embeddings
* GPT-based completion
* Supabase pgvector

### 6.5 Realtime

* Socket.io (NestJS Gateway)
* Event-based communication

---

## 7. Detailed Module Specifications

## Module A – Ingestion & Webhook Layer

### 7.1 Responsibilities

* Accept external events
* Validate & secure payloads
* Ensure idempotency
* Persist raw data
* Publish processing jobs

### 7.2 API Contract

#### 7.2.1 Webhook Endpoints

**POST /api/v1/webhook/booking**

Headers:
* `x-request-id` (UUID, required)
* `x-source-system` (enum: `booking.com`, `airbnb`, `expedia`, `pms`, required)
* `x-signature` (HMAC-SHA256, required for external sources)
* `x-timestamp` (Unix timestamp, required)
* `Content-Type: application/json`

Request Body:
```typescript
{
  eventType: 'booking.created' | 'booking.updated' | 'booking.cancelled',
  bookingId: string,
  hotelId: string,
  guest: {
    firstName: string,
    lastName: string,
    email: string,
    phone?: string
  },
  checkIn: string (ISO 8601),
  checkOut: string (ISO 8601),
  roomType: string,
  totalAmount: number,
  currency: string,
  metadata?: Record<string, any>
}
```

Response:
* `202 Accepted` - Successfully queued
* `400 Bad Request` - Invalid payload
* `401 Unauthorized` - Invalid signature
* `409 Conflict` - Duplicate request (idempotency)
* `429 Too Many Requests` - Rate limit exceeded
* `500 Internal Server Error` - Server error

**POST /api/v1/webhook/pms**

Similar structure for PMS-specific events (room status, inventory updates, etc.)

#### 7.2.2 Flow

1. **Signature Validation**
   - Verify HMAC-SHA256 signature using shared secret
   - Check timestamp (reject if > 5 minutes old)
   
2. **Payload Validation**
   - Validate against DTO using class-validator
   - Check required fields
   - Validate date formats and ranges
   
3. **Idempotency Check**
   - Query MongoDB: `idempotency_keys` collection
   - Key: `{sourceSystem}:{requestId}`
   - If exists → return 409 with existing job ID
   
4. **Raw Data Persistence**
   - Store in MongoDB: `webhook_events` collection
   - Include: payload, headers, timestamp, source IP
   - TTL: 90 days
   
5. **Job Enqueue**
   - Create BullMQ job with payload
   - Job options: priority, delay, attempts
   - Store job ID in idempotency record
   
6. **Response**
   - Return 202 with job ID and correlation ID

#### 7.2.3 Failure Scenarios

* **Postgres Unavailable**: MongoDB persists, job queued, retry when DB recovers
* **Redis Unavailable**: Return 503 Service Unavailable, client retries
* **MongoDB Unavailable**: Return 503, but log to file system as fallback
* **Invalid Signature**: Return 401 immediately, no persistence
* **Rate Limit Exceeded**: Return 429 with `Retry-After` header

---

## Module B – Processing & PMS Sync

### 8.1 Responsibilities

* Consume queue messages
* Map external schema → internal schema
* Persist transactional data
* Handle retries

### 8.2 Retry Strategy

* Exponential Backoff: 5s → 30s → 2m
* Max retry: 3
* DLQ on failure

### 8.3 Data Model

#### 8.3.1 PostgreSQL Schema (Supabase)

**bookings**
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_booking_id VARCHAR(255) NOT NULL,
  source_system VARCHAR(50) NOT NULL,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  guest_id UUID NOT NULL REFERENCES guests(id),
  check_in TIMESTAMP WITH TIME ZONE NOT NULL,
  check_out TIMESTAMP WITH TIME ZONE NOT NULL,
  room_type_id UUID REFERENCES room_types(id),
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(external_booking_id, source_system)
);

CREATE INDEX idx_bookings_hotel_id ON bookings(hotel_id);
CREATE INDEX idx_bookings_guest_id ON bookings(guest_id);
CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX idx_bookings_status ON bookings(status);
```

**guests**
```sql
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  preferred_language VARCHAR(10) DEFAULT 'tr',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_guests_email ON guests(email);
```

**hotels**
```sql
CREATE TABLE hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  timezone VARCHAR(50) DEFAULT 'Europe/Istanbul',
  settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**room_types**
```sql
CREATE TABLE room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  max_occupancy INTEGER,
  amenities JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**idempotency_keys**
```sql
CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA256 of {sourceSystem}:{requestId}
  source_system VARCHAR(50) NOT NULL,
  request_id VARCHAR(255) NOT NULL,
  job_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_idempotency_key_hash ON idempotency_keys(key_hash);
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

**knowledge_chunks** (for RAG)
```sql
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES hotels(id),
  content TEXT NOT NULL,
  metadata JSONB,
  embedding vector(1536), -- OpenAI ada-002 dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_knowledge_embedding ON knowledge_chunks 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_knowledge_hotel ON knowledge_chunks(hotel_id);
```

**chat_sessions**
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id),
  booking_id UUID REFERENCES bookings(id),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**chat_messages**
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id),
  role VARCHAR(20) NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON chat_messages(session_id, created_at);
```

#### 8.3.2 MongoDB Collections

**webhook_events**
```typescript
{
  _id: ObjectId,
  requestId: string,
  sourceSystem: string,
  eventType: string,
  payload: object,
  headers: object,
  sourceIp: string,
  timestamp: Date,
  processed: boolean,
  jobId?: string
}
```

**processing_logs**
```typescript
{
  _id: ObjectId,
  jobId: string,
  correlationId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  attempts: number,
  error?: string,
  timestamps: {
    queued: Date,
    started?: Date,
    completed?: Date
  }
}
```

---

## Module C – AI Knowledge & RAG Engine

### 9.1 Knowledge Ingestion

* Source: PDF / Markdown / Plain text
* Chunking strategy: 300–500 tokens
* Embedding generation
* Store vectors in pgvector

### 9.2 Query Flow

1. **User Question Received**
   - Validate input (max 500 characters)
   - Extract session context (guest, booking, hotel)
   
2. **Embedding Generation**
   - Use OpenAI `text-embedding-ada-002`
   - Generate vector for user question
   - Cache embeddings (TTL: 1 hour)
   
3. **Vector Similarity Search**
   - Query pgvector: `SELECT * FROM knowledge_chunks 
     WHERE hotel_id = $1 
     ORDER BY embedding <=> $2 
     LIMIT 5`
   - Similarity threshold: > 0.7
   - Filter by hotel-specific context
   
4. **Context Retrieval**
   - Retrieve top-K chunks (K=5)
   - Include metadata (source, last_updated)
   - Combine with booking context if available
   
5. **Prompt Construction**
   ```typescript
   System Prompt:
   "Sen {hotel_name} otelinin misafir asistanısın. 
   Sadece aşağıdaki bilgileri kullanarak cevap ver.
   Eğer soru bu bilgilerle cevaplanamazsa, 'Bu bilgi mevcut değil' de.
   
   Otel Bilgileri:
   {retrieved_chunks}
   
   Misafir Bilgileri:
   - Ad: {guest_name}
   - Rezervasyon: {booking_id}
   - Check-in: {check_in}
   - Check-out: {check_out}
   "
   ```
   
6. **LLM Completion**
   - Model: `gpt-4-turbo-preview` (or `gpt-3.5-turbo` for cost optimization)
   - Temperature: 0.3 (lower for consistency)
   - Max tokens: 500
   - Stream: true (for realtime experience)
   
7. **Response Processing**
   - Log interaction to `chat_messages`
   - Return streaming response via Socket.io

### 9.3 Prompt Safety

* **System Role Enforcement**: Always include system prompt, never allow role override
* **Context-Only Answering**: Only use retrieved chunks + booking context
* **Hallucination Prevention**: 
  - If similarity score < 0.7 → return "Bu bilgi mevcut değil"
  - If no chunks retrieved → return "Bu bilgi mevcut değil"
* **Content Filtering**: 
  - Check OpenAI moderation API
  - Block inappropriate requests
* **Rate Limiting**: 
  - Per guest: 20 requests/minute
  - Per session: 100 requests/hour
* **Fallback Response**: "Üzgünüm, bu bilgi şu anda mevcut değil. Lütfen resepsiyon ile iletişime geçin."

### 9.4 Knowledge Ingestion API

**POST /api/v1/knowledge/ingest**

Request:
```typescript
{
  hotelId: string,
  source: 'pdf' | 'markdown' | 'text',
  content: string, // or file upload
  metadata?: {
    category?: string,
    lastUpdated?: string
  }
}
```

Process:
1. Parse content (PDF → text extraction, Markdown → parse)
2. Chunk text (300-500 tokens, overlap: 50 tokens)
3. Generate embeddings for each chunk
4. Store in `knowledge_chunks` with hotel_id
5. Return ingestion status

**GET /api/v1/knowledge/{hotelId}**

List all knowledge chunks for a hotel

**DELETE /api/v1/knowledge/{chunkId}**

Remove a knowledge chunk

---

## Module D – Realtime Communication

### 10.1 Gateway Design

* Namespaced sockets
* Room-based sessions (per guest)

### 10.2 Events

#### Client → Server Events

**guest:message**
```typescript
{
  sessionId: string,
  message: string,
  timestamp: number
}
```

**guest:typing**
```typescript
{
  sessionId: string,
  isTyping: boolean
}
```

**guest:disconnect**
```typescript
{
  sessionId: string
}
```

#### Server → Client Events

**assistant:typing**
```typescript
{
  sessionId: string,
  isTyping: boolean
}
```

**assistant:response**
```typescript
{
  sessionId: string,
  message: string,
  messageId: string,
  timestamp: number,
  isComplete: boolean // for streaming
}
```

**assistant:error**
```typescript
{
  sessionId: string,
  error: string,
  code: string
}
```

**session:created**
```typescript
{
  sessionId: string,
  guestId: string,
  bookingId?: string
}
```

### 10.3 Connection Flow

1. **Authentication**
   - Client connects with JWT token or session token
   - Validate token, extract guest_id
   - Create/retrieve chat session
   
2. **Room Assignment**
   - Join namespace: `/guest/{guestId}`
   - Join room: `session:{sessionId}`
   - Emit `session:created`
   
3. **Message Handling**
   - Receive `guest:message`
   - Emit `assistant:typing:true`
   - Process via RAG engine (async)
   - Stream response chunks via `assistant:response`
   - Emit `assistant:typing:false`
   
4. **Disconnection**
   - Clean up session state
   - Save pending messages
   - Log disconnect reason

### 10.4 Performance Targets

* **Connection Latency**: < 100ms
* **Message Processing**: < 200ms (first token)
* **Streaming Latency**: < 50ms between chunks
* **Concurrent Connections**: 10,000+ per instance
* **Message Throughput**: 1,000 messages/second

---

## 11. Security Considerations

### 11.1 Authentication & Authorization

**JWT-based Authentication**
- Access tokens: 15 minutes expiry
- Refresh tokens: 7 days expiry
- Token rotation on refresh
- Blacklist support for revoked tokens

**API Keys**
- For webhook endpoints: HMAC-SHA256 signed requests
- Per-source-system keys stored in encrypted vault
- Key rotation policy: 90 days

**Role-Based Access Control (RBAC)**
```typescript
Roles:
- guest: Can access own bookings, chat sessions
- hotel_staff: Can access hotel data, manage knowledge
- admin: Full system access
- system: Internal service-to-service communication
```

### 11.2 Webhook Security

**Signature Validation**
```typescript
// Expected signature format
const signature = crypto
  .createHmac('sha256', secretKey)
  .update(timestamp + JSON.stringify(payload))
  .digest('hex');

// Validation
const isValid = crypto.timingSafeEqual(
  Buffer.from(receivedSignature),
  Buffer.from(expectedSignature)
);
```

**Timestamp Validation**
- Reject requests older than 5 minutes
- Prevent replay attacks
- Log suspicious patterns

**IP Whitelisting** (Optional)
- Configurable per source system
- Store in Redis for fast lookup

### 11.3 Rate Limiting

**Strategy**: Token Bucket Algorithm (via `@nestjs/throttler`)

**Limits**:
- Webhook endpoints: 100 requests/minute per source
- Chat API: 20 requests/minute per guest
- Knowledge API: 10 requests/minute per hotel
- Authentication: 5 attempts/minute per IP

**Implementation**:
```typescript
@Throttle({ default: { limit: 100, ttl: 60000 } })
@Controller('webhook')
```

### 11.4 Input Validation & Sanitization

- **DTO Validation**: class-validator decorators
- **SQL Injection Prevention**: Parameterized queries only
- **XSS Prevention**: Sanitize all user inputs
- **File Upload**: 
  - Max size: 10MB
  - Allowed types: PDF, TXT, MD
  - Virus scanning (optional)

### 11.5 Secrets Management

- **Environment Variables**: `.env` files (never commit)
- **Supabase Vault**: For production secrets
- **Key Rotation**: Automated rotation scripts
- **Secret Access**: Least privilege principle

### 11.6 Data Protection

- **Encryption at Rest**: Supabase encryption, MongoDB encryption
- **Encryption in Transit**: TLS 1.3 for all connections
- **PII Handling**: 
  - Mask sensitive data in logs
  - GDPR compliance (right to deletion)
  - Data retention policies

### 11.7 Security Headers

```typescript
app.use(helmet({
  contentSecurityPolicy: true,
  hsts: { maxAge: 31536000 },
  noSniff: true,
  xssFilter: true
}));
```

---

## 12. Observability

### 12.1 Logging

**Structured Logging** (Winston + Pino)
```typescript
{
  timestamp: '2024-01-15T10:30:00Z',
  level: 'info',
  correlationId: 'uuid',
  service: 'webhook-ingestion',
  message: 'Webhook received',
  metadata: {
    sourceSystem: 'booking.com',
    requestId: 'req-123',
    processingTime: 45
  }
}
```

**Log Levels**:
- `error`: Errors requiring attention
- `warn`: Warning conditions
- `info`: Informational messages
- `debug`: Detailed debugging information

**Log Destinations**:
- Console (development)
- File rotation (production)
- External service (Datadog, CloudWatch, etc.)

### 12.2 Metrics

**Key Metrics** (Prometheus format):
- `http_requests_total`: Total HTTP requests
- `http_request_duration_seconds`: Request latency
- `webhook_events_total`: Webhook events by source
- `queue_jobs_total`: BullMQ job counts
- `queue_job_duration_seconds`: Job processing time
- `ai_requests_total`: AI API calls
- `ai_response_time_seconds`: AI response latency
- `socket_connections_active`: Active WebSocket connections
- `database_query_duration_seconds`: DB query performance
- `errors_total`: Error counts by type

**Dashboards**:
- Real-time system health
- Webhook ingestion rate
- Queue depth and processing time
- AI service performance
- Error rates and types

### 12.3 Tracing

**Distributed Tracing** (OpenTelemetry)
- Trace ID propagation across services
- Span creation for:
  - HTTP requests
  - Database queries
  - Queue operations
  - External API calls
- Export to Jaeger or similar

### 12.4 Error Tracking

**Error Aggregation** (Sentry or similar)
- Automatic error capture
- Stack trace collection
- Context enrichment (user, request, environment)
- Alerting on error spikes
- Error grouping and deduplication

### 12.5 Health Checks

**GET /health**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "mongodb": "healthy",
    "openai": "healthy"
  }
}
```

**GET /health/ready**
- Kubernetes readiness probe
- Checks all critical dependencies

**GET /health/live**
- Kubernetes liveness probe
- Basic service availability

### 12.6 Alerting

**Alert Conditions**:
- Error rate > 5% for 5 minutes
- Queue depth > 1000 jobs
- Database connection failures
- AI API failures > 10/minute
- Response time p95 > 1 second
- Service downtime

**Notification Channels**:
- Slack
- Email
- PagerDuty (critical alerts)

---

## 13. Testing Strategy

* Unit tests (Services)
* Integration tests (Queue → DB)
* Mock AI responses

---

## 14. Deployment & Scalability

* Stateless NestJS services
* Horizontal scaling
* Worker autoscaling

---

## 15. Job Alignment Matrix

| Requirement         | Covered |
| ------------------- | ------- |
| NestJS              | ✅       |
| Supabase / Postgres | ✅       |
| PMS Integrations    | ✅       |
| OpenAI / RAG        | ✅       |
| Vector DB           | ✅       |
| Realtime            | ✅       |
| Performance         | ✅       |
| Security            | ✅       |

---

## 16. Conclusion

Concierge-AI,Backend Developer rolü için yalnızca teknik yeterliliği değil; **sistem tasarımı, hata toleransı, AI entegrasyonu ve ölçeklenebilir backend mühendisliği** yetkinliklerini de net biçimde ortaya koyan production-grade bir referans projedir.

## use it for the job alignments
 - NestJS tabanlı servis ve API’leri tasarlamak/geliştirmek

 - Supabase/Postgres ile veri modelleme ve sorgu optimizasyonu

 - PMS entegrasyonları ve üçüncü parti servislerle çalışma

 - OpenAI/LLM API entegrasyonları, embedding ve vector search akışları

 - Performans, güvenlik, hata ayıklama ve maliyet optimizasyonu

 - Realtime akışlar (WebSocket/Socket.io vb.) üzerinde geliştirme

 - TypeScript + Node.js deneyimi

 - NestJS veya benzeri backend framework tecrübesi

 - REST API tasarımı ve backend mimarisi

 - SQL (Postgres) ve veri modelleme bilgisi

 - OpenAI/LLM kullanımı (prompt, embedding, basit RAG mantığı)

 - Temiz kod, test ve ekip içi iletişim alışkanlığı

 - Supabase tecrübesi

 - Vector DB / pgvector / semantic search deneyimi

 - OAuth / üçüncü parti API entegrasyonları

 - Realtime sistemler

Node.js tabanlı backend servisleri geliştirmek ve bakımını yapmak

Harici servislerle API entegrasyonları (REST ağırlıklı; gerektiğinde farklı protokoller)

Webhook/event tabanlı akışlar, hata yönetimi, retry/backoff ve idempotent işlem tasarımı

Loglama/izleme (monitoring), performans ve güvenilirlik iyileştirmeleri

Veri eşleme (mapping), senkronizasyon ve temel veri modelleme süreçlerine katkı

Ürün ekibiyle birlikte uçtan uca entegrasyon teslim etmek (analiz → geliştirme → test → canlı)

Node.js ile backend geliştirme deneyimi (Express/Fastify vb.)

API tasarımı ve entegrasyon pratiği (auth, pagination, rate limit, webhook doğrulama vb.)

NoSQL (özellikle MongoDB) deneyimi

Asenkron çalışma, kuyruk mantığı, hata senaryoları ve sistematik debug alışkanlığı

Git ve temel CI/CD yaklaşımına aşinalık

Orta seviye İngilizce (doküman okuma/entegrasyon iletişimi)

