# Nova — Architecture Document

> **Repository:** Nova (Backend + ML)
> **Last Updated:** March 2026
> **Status:** Active — reflects all decisions made through design sessions

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Subgraph Design](#2-subgraph-design)
3. [Technology Stack](#3-technology-stack)
4. [Repository Structure](#4-repository-structure)
5. [Service Structure](#5-service-structure)
6. [GraphQL Federation Architecture](#6-graphql-federation-architecture)
7. [Subgraph Schemas](#7-subgraph-schemas)
8. [Gateway Design](#8-gateway-design)
9. [Data Architecture](#9-data-architecture)
10. [Security Architecture](#10-security-architecture)
11. [Infrastructure & Scaling](#11-infrastructure--scaling)
12. [Development Workflow](#12-development-workflow)
13. [Architecture Decision Records](#13-architecture-decision-records)

---

## 1. Project Overview

### What is Mini Doctor?

Mini Doctor is an **AI-powered healthcare information platform** delivered as a React Native mobile app for the Indian market. It provides conversational health guidance, medicine explanations, lab test interpretations, emotional wellness support, and personalized health insights.

Nova is the **combined backend + ML repository** serving all Mini Doctor features.

### Key Characteristics

| Attribute | Value |
|-----------|-------|
| Platform | React Native (iOS + Android) |
| Target Market | India |
| Languages | English, Hindi, Hinglish |
| Monetization | Freemium (Free, Silver ₹99/mo, Gold ₹299/mo) |
| Phase 1 Budget | ₹10,00,000 |
| Timeline | 24 weeks |

### What Mini Doctor Does NOT Do

- ✗ Provide medical diagnoses
- ✗ Prescribe medications or dosages
- ✗ Replace professional medical advice
- ✗ Offer telemedicine or video consultations

---

## 2. Subgraph Design

### Design Principles

Subgraph boundaries are driven by **domain cohesion, failure isolation, and scaling** — not team ownership (everyone works across all services).

### Final Subgraph Split

| # | Subgraph | Port | Modules | Responsibility |
|---|----------|------|---------|----------------|
| 1 | **Auth** | 4001 | — | Identity, OTP, JWT, sessions |
| 2 | **Profile** | 4002 | 2.6, 2.8 | Family profiles, user settings, health tags |
| 3 | **Commerce** | 4003 | 2.7 | Subscriptions, payments, Razorpay, billing |
| 4 | **Chat/AI** | 4004 | 2.1, 2.5, 2.9, 2.10 | Conversational AI, emotional wellness, insights, multi-language |
| 5 | **Content** | 4005 | 2.2, 2.12 | Health news, web preview routing |

### Why This Split

**Auth vs Profile** — Auth owns identity (phone, tokens). Profile owns what a user does with that identity. Different change rates, different failure modes.

**Commerce alone** — Payment failures and Razorpay webhook retries must never cascade into profile or chat. Razorpay webhooks are REST endpoints on this service only.

**Medical Reference (2.3, 2.4) — Deferred** — Medicine explanation and lab test explanation are dropped from Phase 1. Will be added as a standalone subgraph in a later phase.

**Chat/AI together** — All AI modules (2.1, 2.5, 2.9, 2.10) share the same LLM routing, RAG pipeline, and ChromaDB infrastructure. Different scaling profile from the rest but cohesive internally.

**Content absorbs 2.12** — Health news and web preview are both read-heavy, CMS-driven, no LLM involved. Merged for simplicity.

**Emergency (2.11) — Not a subgraph** — The SOS button triggers the device dialer client-side. The only backend concern is logging the SOS event. Handled by a single REST endpoint `POST /emergency/sos` on the Profile service.

### Subscription Tier Features

| Feature | Free | Silver (₹99) | Gold (₹299) |
|---------|------|--------------|-------------|
| Daily Messages | 5 | 30 | Unlimited |
| Profiles | 1 | 2 | 5 |
| LLM Model | Gemini Flash | GPT-4o-mini | GPT-4o |
| Languages | EN only | EN, HI | EN, HI, Hinglish |
| Wellness Insights | None | Weekly | Daily |
| Chat History | 7 days | 30 days | Unlimited |
| Support | Community | Email | Priority |

---

## 3. Technology Stack

| Category | Technology | Notes |
|----------|------------|-------|
| **Runtime** | Node.js LTS | — |
| **Language** | TypeScript (strict) | All services |
| **HTTP Framework** | Express | All subgraphs |
| **GraphQL Server** | Apollo Server 4 + `@apollo/subgraph` | Schema-first SDL |
| **GraphQL Approach** | Schema-first (SDL) | `.graphql` files as source of truth |
| **Type Generation** | `graphql-codegen` | Generates TS types from SDL |
| **Gateway** | Apollo Router | Rust-based, Federation 2 |
| **ORM** | Prisma | Multi-schema, one DB per environment |
| **Primary Database** | PostgreSQL 15+ | Single instance, schema-per-service |
| **Cache** | Redis 7+ | Sessions, rate limits, conversation context |
| **Vector Database** | ChromaDB → Pinecone | Phase 1 → Phase 2 |
| **Message Queue** | Redis Streams | Async operations |
| **Object Storage** | S3 / Cloudflare R2 | Files, backups |
| **LLM Providers** | OpenAI, Google Gemini | Multi-provider routing |
| **Payment Gateway** | Razorpay | India-focused |
| **Push Notifications** | Firebase FCM | — |
| **SMS / OTP** | MSG91 | India OTP |
| **Email** | SendGrid | Transactional |
| **Package Manager** | npm workspaces | Monorepo |
| **Hot Reload** | `tsx --watch` | Dev only |
| **Containerisation** | Docker + Docker Compose | All services |
| **Orchestration** | Docker Compose → K8s | Phase 1 → Phase 2 |
| **CI/CD** | GitHub Actions | — |
| **Monitoring** | Prometheus + Grafana | — |
| **Logging** | Loki / CloudWatch | Centralised |
| **Error Tracking** | Sentry | — |
| **Tracing** | OpenTelemetry | — |

### LLM Model Routing

| User Tier | Primary Model | Fallback | Est. Cost/Message |
|-----------|---------------|----------|-------------------|
| Free | Gemini 1.5 Flash | Templates | ₹0.01 |
| Silver | GPT-4o-mini | Gemini Flash | ₹0.02–0.05 |
| Gold | GPT-4o | GPT-4o-mini | ₹0.40–0.50 |
| Emergency/Crisis | GPT-4o (always) | Claude | Best available |

---

## 4. Repository Structure

```
Nova/
├── package.json               # npm workspace root
├── tsconfig.base.json         # shared TS config extended by all services
├── .env.example
├── .gitignore
├── Makefile
├── ARCHITECTURE.md
├── docker-compose.yml
├── docker-compose.dev.yml
│
├── gateway/
│   ├── router.yaml            # Apollo Router config (JWT, limits, coprocessor)
│   ├── supergraph.yaml        # rover composition config (lists all subgraph URLs)
│   ├── entrypoint.sh          # composes schema then starts router
│   └── Dockerfile
│
├── shared/                    # @nova/shared — internal npm workspace package
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── auth/
│       │   └── jwt.ts         # JWT sign / verify / decode
│       ├── db/
│       │   └── client.ts      # Prisma client singleton factory
│       ├── logger.ts          # structured logging
│       └── errors.ts          # shared error classes
│
├── services/
│   ├── auth/                  # @nova/auth     — port 4001
│   ├── profile/               # @nova/profile  — port 4002
│   ├── commerce/              # @nova/commerce — port 4003
│   ├── chat/                  # @nova/chat     — port 4004
│   └── content/               # @nova/content  — port 4005
│
├── coprocessor/               # @nova/coprocessor — port 4010 (rate limiter)
│
└── scripts/
    ├── init-db.sql            # creates postgres schemas at first boot
    ├── compose-schema.sh      # rover supergraph compose
    ├── migrate.sh             # prisma migrate deploy (all services)
    └── dev-setup.sh           # first-time local setup
```

---

## 5. Service Structure

Every service follows the same internal layout:

```
services/auth/
├── package.json
├── tsconfig.json
├── codegen.yml                # graphql-codegen config
├── prisma/
│   └── schema.prisma          # Prisma schema — scoped to this service's PG schema
└── src/
    ├── index.ts               # Express app + Apollo Server entry point
    ├── schema.graphql         # SDL — single source of truth for this subgraph
    ├── resolvers/
    │   ├── index.ts           # merges all resolver maps
    │   ├── Query.ts
    │   ├── Mutation.ts
    │   └── User.ts            # entity resolver (__resolveReference)
    ├── services/
    │   └── authService.ts     # business logic (OTP, JWT, hashing, etc.)
    ├── generated/
    │   └── types.ts           # auto-generated by graphql-codegen — never edit
    └── __tests__/
```

### How a Service Starts (`src/index.ts`)

```
1. Load schema.graphql via fs.readFileSync
2. Import resolvers from resolvers/index.ts
3. Call buildSubgraphSchema({ typeDefs, resolvers }) from @apollo/subgraph
4. Create ApolloServer with the subgraph schema
5. Mount via expressMiddleware at /graphql
6. Add GET /health endpoint
7. Listen on port
```

### Key Dependencies (per service)

```json
{
  "@apollo/server": "^4.x",
  "@apollo/subgraph": "^2.x",
  "@nova/shared": "*",
  "express": "^4.x",
  "graphql": "^16.x",
  "prisma": "^6.x",
  "@prisma/client": "^6.x",
  "zod": "^3.x"
}
```

---

## 6. GraphQL Federation Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REACT NATIVE APP                             │
│              Apollo Client (cache, subscriptions, offline)          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS / WSS
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      APOLLO ROUTER  :4000                           │
│                                                                     │
│  • Schema composition      • Query planning                         │
│  • JWT validation          • Tier-aware rate limiting (coprocessor) │
│  • Query depth limits      • Complexity analysis                    │
│  • Persisted queries       • WebSocket subscriptions (chat)         │
└──────────┬──────────────┬──────────────┬──────────────┬────────────┘
           │              │              │              │
           ▼              ▼              ▼              ▼
    ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌─────────────┐
    │    AUTH    │ │  PROFILE   │ │   COMMERCE   │ │   CHAT/AI   │
    │   :4001    │ │   :4002    │ │    :4003     │ │    :4004    │
    └────────────┘ └────────────┘ └──────────────┘ └─────────────┘
                                                          │
                                                   ┌─────────────┐
                                                   │   CONTENT   │
                                                   │    :4005    │
                                                   └─────────────┘
           │              │              │              │
           └──────────────┴──────────┬───┴──────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SHARED DATA LAYER                           │
│   PostgreSQL (schemas)  │  Redis  │  ChromaDB  │  S3/R2            │
└─────────────────────────────────────────────────────────────────────┘
```

### Query Planning Example

Home screen needs: user identity + active profile + subscription tier + trending news.

Client sends **one query**:

```graphql
query HomeScreen {
  me {                          # → Auth subgraph
    id
    profiles {                  # → Profile subgraph
      name
      ageGroup
    }
    subscription {              # → Commerce subgraph
      tier
      limits { dailyMessages }
    }
  }
  trendingNews(limit: 5) {     # → Content subgraph
    title
    summary
  }
}
```

Router plan: fetch `me { id }` from Auth → fan out in parallel to Profile, Commerce, Content → merge → single response. Client never sees the subgraphs.

### REST Hybrid Endpoints

Some operations bypass GraphQL entirely:

| Endpoint | Service | Purpose |
|----------|---------|---------|
| `POST /webhooks/razorpay` | Commerce | Payment callbacks |
| `POST /webhooks/firebase` | Profile | Push notification callbacks |
| `POST /upload/profile-photo` | Profile | File uploads |
| `POST /emergency/sos` | Profile | SOS event logging (Module 2.11) |
| `GET /health` | All | Health checks |
| `GET /.well-known/jwks.json` | Auth | JWT public keys for Router |

---

## 7. Subgraph Schemas

### Auth Subgraph

```graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

type User @key(fields: "id") {
  id: ID!
  phone: String!
  email: String
  phoneVerified: Boolean!
  status: UserStatus!
  createdAt: DateTime!
}

type AuthPayload {
  accessToken: String!
  refreshToken: String!
  expiresIn: Int!
  user: User!
}

type OTPResponse {
  success: Boolean!
  message: String!
}

type Query {
  me: User
}

type Mutation {
  sendOTP(phone: String!): OTPResponse!
  verifyOTP(phone: String!, otp: String!): AuthPayload!
  refreshToken(refreshToken: String!): AuthPayload!
  logout: Boolean!
}

enum UserStatus { ACTIVE INACTIVE SUSPENDED }
scalar DateTime
```

### Profile Subgraph

```graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0",
        import: ["@key", "@external", "extend"])

type User @key(fields: "id") {
  id: ID! @external
  profiles: [Profile!]!
  activeProfile: Profile
}

type Profile @key(fields: "id") {
  id: ID!
  userId: ID!
  name: String!
  dateOfBirth: Date!
  age: Int!
  gender: Gender!
  ageGroup: AgeGroup!
  healthTags: [String!]!
  emergencyContacts: [EmergencyContact!]!
  isActive: Boolean!
}

type EmergencyContact {
  id: ID!
  name: String!
  phone: String!
  relationship: String!
}

type Query {
  profile(id: ID!): Profile
}

type Mutation {
  createProfile(input: CreateProfileInput!): Profile!
  updateProfile(input: UpdateProfileInput!): Profile!
  deleteProfile(id: ID!): Boolean!
  setActiveProfile(profileId: ID!): Profile!
}

enum Gender  { MALE FEMALE OTHER }
enum AgeGroup { CHILD TEEN ADULT SENIOR }
scalar Date
```

### Commerce Subgraph

```graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0",
        import: ["@key", "@external"])

type User @key(fields: "id") {
  id: ID! @external
  subscription: Subscription
}

type Subscription @key(fields: "id") {
  id: ID!
  tier: SubscriptionTier!
  status: SubscriptionStatus!
  currentPeriodEnd: DateTime!
  limits: TierLimits!
  usage: CurrentUsage!
}

type TierLimits {
  dailyMessages: Int!
  maxProfiles: Int!
  languages: [String!]!
  chatHistoryDays: Int!
  wellnessInsights: InsightFrequency!
}

type CurrentUsage {
  messagesToday: Int!
  messagesLimit: Int!
}

type Mutation {
  createSubscription(planId: ID!, razorpayPaymentId: String!): Subscription!
  cancelSubscription: Boolean!
}

enum SubscriptionTier   { FREE SILVER GOLD }
enum SubscriptionStatus { ACTIVE CANCELLED EXPIRED PAST_DUE }
enum InsightFrequency   { NONE WEEKLY DAILY }
```

### Chat/AI Subgraph

```graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0",
        import: ["@key", "@external"])

type Profile @key(fields: "id") {
  id: ID! @external
  conversations: [Conversation!]!
  activeConversation: Conversation
  wellnessInsights: [WellnessInsight!]!
}

type Conversation @key(fields: "id") {
  id: ID!
  module: ChatModule!
  messages: [Message!]!
  status: ConversationStatus!
  language: Language!
  createdAt: DateTime!
}

type Message {
  id: ID!
  role: MessageRole!
  content: String!
  language: Language!
  createdAt: DateTime!
}

type WellnessInsight @key(fields: "id") {
  id: ID!
  summary: String!
  insights: [InsightCard!]!
  recommendations: [String!]!
  generatedAt: DateTime!
}

type InsightCard {
  title: String!
  description: String!
  category: String!
}

input SendMessageInput {
  conversationId: ID!
  content: String!
  language: Language
}

type SendMessagePayload {
  userMessage: Message!
  assistantMessage: Message!
}

type Query {
  conversation(id: ID!): Conversation
}

type Mutation {
  startConversation(profileId: ID!, module: ChatModule!): Conversation!
  sendMessage(input: SendMessageInput!): SendMessagePayload!
}

type Subscription {
  onNewMessage(conversationId: ID!): Message!
}

enum ChatModule        { GENERAL EMOTIONAL }
enum ConversationStatus { ACTIVE ARCHIVED }
enum MessageRole       { USER ASSISTANT SYSTEM }
enum Language          { EN HI HINGLISH }
```

### Content Subgraph

```graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

type HealthNews @key(fields: "id") {
  id: ID!
  title: String!
  summary: String!
  content: String!
  category: NewsCategory!
  language: Language!
  imageUrl: String
  featured: Boolean!
  publishedAt: DateTime!
}

type Query {
  healthNews(
    category: NewsCategory
    language: Language
    limit: Int
    offset: Int
  ): [HealthNews!]!

  trendingNews(language: Language, limit: Int): [HealthNews!]!
  newsById(id: ID!): HealthNews
}

enum NewsCategory {
  GENERAL
  NUTRITION
  MENTAL_HEALTH
  FITNESS
  DISEASE_AWARENESS
  SEASONAL
}

enum Language { EN HI HINGLISH }
```

---

## 8. Gateway Design

### Apollo Router Config (`gateway/router.yaml`)

```yaml
supergraph:
  listen: 0.0.0.0:4000

health_check:
  listen: 0.0.0.0:8088
  enabled: true

sandbox:
  enabled: true          # disabled in production

authentication:
  router:
    jwt:
      jwks:
        - url: http://auth:4001/.well-known/jwks.json

coprocessor:
  url: http://coprocessor:4010
  router:
    request:
      headers: true
      body: false

limits:
  max_depth: 10
  max_aliases: 15
  max_complexity: 1000

headers:
  all:
    request:
      - propagate:
          named: "x-user-id"
      - propagate:
          named: "x-user-tier"
      - propagate:
          named: "x-profile-id"
```

### JWT Flow

1. Router validates JWT using JWKS from Auth service
2. On success, extracts claims and forwards as headers to subgraphs:
   - `x-user-id`, `x-user-tier`, `x-profile-id`
3. Subgraphs **trust these headers** — they do not re-validate the JWT
4. Auth subgraph is called **only** for `sendOTP`, `verifyOTP`, `refreshToken`, `logout`

### Rate Limiting (Coprocessor)

Apollo Router does not natively support dynamic rate limiting. A small Express coprocessor sidecar handles it:

```
Request → Router → Coprocessor (reads x-user-tier, checks Redis counters) → allow / 429
```

| Operation | Free | Silver | Gold |
|-----------|------|--------|------|
| sendMessage | 5/day | 30/day | Unlimited |
| All queries | 100/min | 300/min | 1000/min |
| All mutations | 20/min | 60/min | 200/min |

### Gateway Startup (entrypoint.sh)

```
1. Wait for all subgraphs to pass health checks
2. rover supergraph compose --config supergraph.yaml > supergraph.graphql
3. Start Apollo Router with composed schema
```

In dev, Router also receives `--dev` flag (enables Apollo Sandbox at /).

---

## 9. Data Architecture

### PostgreSQL — Schema per Service

Single PostgreSQL instance. Each service has its own schema, configured in Prisma:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["auth"]           // one schema per service
}
```

| Service | PG Schema | Key Tables |
|---------|-----------|------------|
| Auth | `auth` | users, sessions, otp_requests |
| Profile | `profile` | profiles, emergency_contacts |
| Commerce | `commerce` | plans, subscriptions, payments |
| Chat/AI | `chat` | conversations, messages, wellness_insights |
| Content | `content` | health_news, news_categories |

No cross-service database access. Services communicate via GraphQL only.

### Caching Strategy (Redis)

| Cache | Content | TTL |
|-------|---------|-----|
| Session | JWT refresh tokens | 7 days |
| Rate Limit | API call counters | 1 min – 1 day |
| Subscription Status | Tier + limits | 1 hour |
| Conversation Context | Last N messages | 30 minutes |
| LLM Response | Common cached queries | 1–7 days |

### Vector Collections (ChromaDB)

| Collection | Module | Content |
|------------|--------|---------|
| symptoms | 2.1, 2.5 | Symptom guidance |
| wellness | 2.5, 2.9 | Mental health resources |
| health_general | 2.1 | General health knowledge |

---

## 10. Security Architecture

### Layers

| Layer | Controls |
|-------|----------|
| Edge | DDoS (Cloudflare), WAF, SSL/TLS |
| Gateway | JWT validation, rate limiting, query depth + complexity |
| Application | Input validation (Zod), header-based AuthZ, profile isolation |
| Data | AES-256 at rest, TLS 1.3 in transit, PII masking in logs |
| Infrastructure | VPC isolation, security groups, secrets via env |

### GraphQL Security

| Control | Value |
|---------|-------|
| Query depth limit | 10 |
| Max aliases | 15 |
| Complexity limit | 1000 |
| Introspection | Disabled in production |
| Persisted queries | Enabled for mobile |

### AI Safety Guardrails

- **Pre-processing:** Input sanitisation, abuse detection, crisis keyword detection
- **Post-processing:** Diagnosis prevention, dosage blocking, disclaimer injection
- **Crisis handling:** Suicidal ideation detected → provide iCall/Vandrevala helpline → escalate to GPT-4o regardless of tier

---

## 11. Infrastructure & Scaling

### Phase 1 — Launch (0–1K DAU)

| Component | Spec |
|-----------|------|
| Apollo Router | 1× (1 CPU, 1 GB RAM) |
| Auth | 1× (0.5 CPU, 1 GB RAM) |
| Profile | 1× (0.5 CPU, 1 GB RAM) |
| Commerce | 1× (0.5 CPU, 1 GB RAM) |
| Chat/AI | 1× (2 CPU, 4 GB RAM) |
| Content | 1× (0.5 CPU, 1 GB RAM) |
| PostgreSQL | 1× (2 CPU, 4 GB RAM) |
| Redis | 1× (1 CPU, 2 GB RAM) |
| **Est. Monthly** | **₹8,000–₹15,000** |

### Phase 2 — Growth (1K–10K DAU)

| Component | Spec |
|-----------|------|
| Apollo Router | 2× behind load balancer |
| Auth / Profile / Commerce / Content | 2× each |
| Chat/AI | 3× auto-scaled |
| PostgreSQL | Primary + read replica (managed) |
| Redis | 3-node cluster (managed) |
| ChromaDB → Pinecone | Migrate for managed scale |
| **Est. Monthly** | **₹25,000–₹50,000** |

---

## 12. Development Workflow

### First-Time Setup

```bash
cp .env.example .env        # fill in secrets
make infra                  # start postgres, redis, chromadb
make migrate                # prisma migrate deploy (all services)
make codegen                # graphql-codegen (all services)
```

### Daily Dev

```bash
make dev
# = docker compose -f docker-compose.yml -f docker-compose.dev.yml up
# Starts everything with tsx --watch hot reload
# Gateway auto-composes supergraph on startup
```

### Makefile Reference

| Target | What it does |
|--------|-------------|
| `make dev` | Full stack with hot reload |
| `make infra` | Postgres + Redis + ChromaDB only |
| `make compose-schema` | rover supergraph compose |
| `make migrate` | prisma migrate deploy (all services) |
| `make codegen` | graphql-codegen (all services) |
| `make build` | tsc build (all services) |
| `make logs service=auth` | docker compose logs -f auth |

### After Changing a GraphQL Schema

```bash
make codegen          # regenerate TypeScript types
make compose-schema   # recompose supergraph (if gateway is running standalone)
# hot reload picks up changes automatically in dev
```

### Key Ports (local)

| Service | Port |
|---------|------|
| Apollo Router (GraphQL) | 4000 |
| Apollo Router (health) | 8088 |
| Auth | 4001 |
| Profile | 4002 |
| Commerce | 4003 |
| Chat/AI | 4004 |
| Content | 4005 |
| Coprocessor | 4010 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| ChromaDB | 8000 |

---

## 13. Architecture Decision Records

| ADR | Decision | Status |
|-----|----------|--------|
| ADR-001 | Modular monorepo (npm workspaces) | Accepted |
| ADR-002 | PostgreSQL as primary database | Accepted |
| ADR-003 | Redis for caching and sessions | Accepted |
| ADR-004 | ChromaDB for vector storage (Phase 1) | Accepted |
| ADR-005 | Multi-LLM provider strategy | Accepted |
| ADR-006 | Express + TypeScript as backend framework | Accepted |
| ADR-007 | JWT-based authentication | Accepted |
| ADR-008 | Three-tier subscription model | Accepted |
| ADR-009 | Redis for LLM response caching | Accepted |
| ADR-010 | API versioning via gateway config | Accepted |
| ADR-011 | Event-driven async via Redis Streams | Accepted |
| ADR-012 | Multi-language support strategy | Accepted |
| ADR-013 | RAG pipeline architecture | Accepted |
| ADR-014 | Safety and guardrails framework | Accepted |
| ADR-015 | Prometheus + Grafana for observability | Accepted |
| ADR-016 | GraphQL with Apollo Federation 2 | Accepted |
| ADR-017 | Schema-first SDL with graphql-codegen | Accepted |
| ADR-018 | 5-subgraph split (Auth, Profile, Commerce, Chat, Content) | Accepted |
| ADR-019 | Emergency (2.11) as REST endpoint, not a subgraph | Accepted |
| ADR-020 | Medical Reference (2.3, 2.4) deferred to later phase | Accepted |
| ADR-021 | Prisma multi-schema (one PG instance, schema per service) | Accepted |
| ADR-022 | Apollo Router coprocessor for tier-aware rate limiting | Accepted |

---

*This document is the single source of truth for Nova's architecture. Update it as decisions evolve.*
