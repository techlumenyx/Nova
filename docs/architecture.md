# Nova — Architecture Guide

> For design decisions and ADR history, see [`ARCHITECTURE.md`](../ARCHITECTURE.md) at the repo root.
> This document is the **developer-facing reference** — how the system is built, how the pieces connect, and what to know before writing code.

---

## Table of Contents

1. [Big Picture](#1-big-picture)
2. [Repository Layout](#2-repository-layout)
3. [The Gateway](#3-the-gateway)
4. [Subgraphs](#4-subgraphs)
5. [Shared Package](#5-shared-package)
6. [Coprocessor](#6-coprocessor)
7. [Database](#7-database)
8. [Authentication Flow](#8-authentication-flow)
9. [LLM Routing](#9-llm-routing)
10. [Adding a New Feature](#10-adding-a-new-feature)
11. [Local Dev Reference](#11-local-dev-reference)

---

## 1. Big Picture

```
React Native App
      │
      ▼
Apollo Router :4000          ← single entry point for all GraphQL traffic
      │
      ├── auth     :4001     ← identity, OTP, JWT
      ├── profile  :4002     ← family profiles, user settings
      ├── commerce :4003     ← subscriptions, Razorpay payments
      ├── chat     :4004     ← LLM chat, emotional wellness, insights
      └── content  :4005     ← health news, web preview
            │
            ▼
      PostgreSQL / Redis / ChromaDB
```

The client sends **one GraphQL query** to the router. The router plans how to split it across subgraphs, fans out in parallel, merges the results, and returns a single response. The client never knows subgraphs exist.

The **coprocessor** (`:4010`) is a sidecar the router calls on every request to enforce tier-aware rate limits via Redis before any subgraph is hit.

---

## 2. Repository Layout

```
Nova/
├── package.json            # npm workspace root — lists all packages
├── tsconfig.base.json      # TS config inherited by every package
├── docker-compose.yml      # full stack
├── docker-compose.dev.yml  # dev overrides (hot reload, volume mounts)
├── Makefile                # developer commands
│
├── gateway/                # Apollo Router (no Node.js code here)
│   ├── router.yaml         # router behaviour: JWT, coprocessor, limits, CORS
│   ├── supergraph.yaml     # tells rover which subgraphs to compose
│   └── entrypoint.sh       # composes schema → starts router
│
├── shared/                 # @nova/shared — imported by all services
│   └── src/
│       ├── auth/jwt.ts     # sign / verify JWT
│       ├── db/client.ts    # Prisma singleton factory
│       ├── logger.ts       # Winston structured logger
│       └── errors.ts       # shared error classes
│
├── services/
│   ├── auth/               # @nova/auth     :4001
│   ├── profile/            # @nova/profile  :4002
│   ├── commerce/           # @nova/commerce :4003
│   ├── chat/               # @nova/chat     :4004
│   └── content/            # @nova/content  :4005
│
├── coprocessor/            # @nova/coprocessor :4010
└── scripts/                # init-db.sql, migrate.sh, compose-schema.sh
```

Every service is an **npm workspace package**. They share `node_modules` at the root and reference each other via `@nova/*` package names.

---

## 3. The Gateway

The gateway is **Apollo Router** — a Rust binary, no Node.js. You do not write application code here.

### What it does

| Responsibility | How |
|----------------|-----|
| Schema composition | `rover supergraph compose` in `entrypoint.sh` at startup |
| JWT validation | Reads JWKS from `http://auth:4001/.well-known/jwks.json` |
| Rate limiting | Delegates to coprocessor via the coprocessor protocol |
| Query routing | Splits queries across subgraphs based on the composed schema |
| Header forwarding | Propagates `x-user-id`, `x-user-tier`, `x-profile-id` to all subgraphs |
| WebSocket subscriptions | Proxies to chat subgraph |

### Startup sequence

```
entrypoint.sh
  └── if supergraph.graphql does NOT exist:
        rover supergraph compose --config supergraph.yaml
          ├── introspects each subgraph's /_service endpoint
          └── writes supergraph.graphql        (dev only)
  └── if supergraph.graphql already exists:
        skip rover — use pre-built schema      (prod / make prod)
  └── router --config router.yaml --supergraph supergraph.graphql
```

**Dev (`make dev`)** — `supergraph.graphql` is never mounted, so rover always recomposes it fresh from the running subgraphs. Schema changes are picked up on the next `make dev`.

**Prod-like (`make prod`)** — runs `make compose-schema` first (generates `gateway/supergraph.graphql`), then starts all services. The gateway volume-mounts the pre-built file and skips rover entirely — startup is fast and subgraphs don't need to be introspectable at gateway restart time.

### Changing router behaviour

Edit `gateway/router.yaml`. Common changes:

```yaml
limits:
  max_depth: 10          # increase if queries need to go deeper
  max_aliases: 15

sandbox:
  enabled: true          # set false in production
```

---

## 4. Subgraphs

### Internal structure (same for every service)

```
services/auth/
├── prisma/schema.prisma
├── codegen.yml
└── src/
    ├── index.ts              # Express + Apollo Server entry point
    ├── context.ts            # request context shape + builder
    │
    ├── schema/               # SDL split by domain — merged at startup
    │   ├── index.ts          # loads + merges all .graphql files recursively
    │   ├── base.graphql      # federation @link directive + shared scalars
    │   ├── types/            # one file per type (user.graphql, profile.graphql …)
    │   ├── queries/          # one file per query group (me.graphql …)
    │   └── mutations/        # one file per mutation (sendOTP.graphql …)
    │
    ├── resolvers/
    │   ├── index.ts          # assembles final resolver map
    │   ├── queries/          # one file per query resolver
    │   ├── mutations/        # one file per mutation resolver
    │   ├── entities/         # __resolveReference + field resolvers per type
    │   └── subscriptions/    # subscription resolvers (chat only)
    │
    ├── services/             # business logic — no GraphQL here
    │   ├── index.ts          # re-exports all services
    │   └── <domain>.service.ts   # one file per domain concern
    │
    └── generated/
        └── types.ts          # auto-generated — never edit manually
```

**Auth is the reference implementation.** All other services follow this exact layout.

### How the schema is loaded (`src/schema/index.ts`)

Instead of one large `schema.graphql`, each service splits its SDL across multiple files. They are merged at startup:

```typescript
import { mergeTypeDefs } from '@graphql-tools/merge';
import { loadFilesSync } from '@graphql-tools/load-files';
import path from 'path';

const typesArray = loadFilesSync(path.join(__dirname), {
  extensions: ['graphql'],
  recursive: true,
});

export const typeDefs = mergeTypeDefs(typesArray);
```

`loadFilesSync` recursively finds every `.graphql` file under `src/schema/`. `mergeTypeDefs` correctly merges duplicate `type Mutation {}` / `type Query {}` blocks from separate files into a single schema.

### How a service starts (`src/index.ts`)

```typescript
import { typeDefs }  from './schema';   // merged SDL from all .graphql files
import { resolvers } from './resolvers';

const schema = buildSubgraphSchema({ typeDefs, resolvers });

app.use('/graphql', expressMiddleware(server, { context: buildContext }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
```

### Federation entities

Types shared across subgraphs use `@key`. The owning subgraph defines the type; other subgraphs extend it.

**Auth owns `User` (`schema/types/user.graphql`):**
```graphql
type User @key(fields: "id") {
  id: ID!
  phone: String!
}
```

**Profile extends `User` (`schema/types/user.graphql`):**
```graphql
type User @key(fields: "id") {
  id: ID! @external
  profiles: [Profile!]!
  activeProfile: Profile
}
```

**Profile must implement `__resolveReference` (`resolvers/entities/User.ts`):**
```typescript
export const User = {
  __resolveReference: async ({ id }: { id: string }) => ({ id }),

  profiles: async ({ id }: { id: string }) => {
    return profileService.getByUser(id);
  },
};
```

If `__resolveReference` is missing, federation silently returns `null` for cross-subgraph queries.

### Request context

The router validates the JWT and forwards user info as headers. Every subgraph reads these in `context.ts`:

```typescript
export function buildContext({ req }: { req: Request }): Context {
  return {
    userId:    req.headers['x-user-id']    as string | undefined,
    userTier:  req.headers['x-user-tier']  as string | undefined,
    profileId: req.headers['x-profile-id'] as string | undefined,
  };
}
```

Subgraphs **trust these headers**. They do not re-validate JWTs.

### Subgraph responsibilities

| Service | Port | GraphQL | REST |
|---------|------|---------|------|
| auth | 4001 | User identity, OTP, JWT | `GET /.well-known/jwks.json` |
| profile | 4002 | Profiles, settings | `POST /emergency/sos` |
| commerce | 4003 | Subscriptions, plans | `POST /webhooks/razorpay` |
| chat | 4004 | Chat, wellness, insights | — |
| content | 4005 | Health news | — |

---

## 5. Shared Package

`@nova/shared` is an internal npm workspace package imported by all services. Add utilities here only if **at least two services need them**.

```typescript
import { logger, getPrismaClient, AuthenticationError, verifyToken } from '@nova/shared';
```

### What's in it

| Export | Purpose |
|--------|---------|
| `logger` | Winston structured logger — always use this, never `console.log` |
| `getPrismaClient()` | Returns a singleton Prisma client |
| `signAccessToken()` | JWT sign helper |
| `signRefreshToken()` | JWT sign helper |
| `verifyToken()` | JWT verify helper |
| `AuthenticationError` | Throw when user is not authenticated |
| `AuthorizationError` | Throw when user lacks permission |
| `NotFoundError` | Throw when a resource doesn't exist |
| `RateLimitError` | Throw when rate limit is exceeded |
| `ValidationError` | Throw for input validation failures |

---

## 6. Coprocessor

The coprocessor is a small Express app that implements the [Apollo Router coprocessor protocol](https://www.apollographql.com/docs/router/customizations/coprocessor).

The router calls it via `POST /` on every `RouterRequest`. The coprocessor:
1. Reads `x-user-id` and `x-user-tier` from the forwarded headers
2. Checks a Redis counter for the current rate limit window
3. Returns the request unchanged (allow) or `{ control: { break: 429 } }` (deny)

**Daily message limits** (enforced inside the chat service itself, not the coprocessor):

| Tier | Messages/day | Queries/min |
|------|-------------|-------------|
| FREE | 5 | 100 |
| SILVER | 30 | 300 |
| GOLD | Unlimited | 1000 |

---

## 7. Database

### One PostgreSQL instance, five schemas

Each service has its own PostgreSQL schema — isolated tables, no cross-service queries.

| Service | PG Schema | Key Tables |
|---------|-----------|------------|
| auth | `auth` | users, sessions, otp_requests |
| profile | `profile` | profiles, emergency_contacts, sos_logs |
| commerce | `commerce` | plans, subscriptions, payments |
| chat | `chat` | conversations, messages, wellness_insights |
| content | `content` | health_news, news_categories |

The schemas are created by `scripts/init-db.sql` which runs automatically when the postgres container first boots.

### Prisma setup

Each service has its own `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["auth"]           // ← this service's schema only
}

model User {
  ...
  @@schema("auth")              // ← every model declares its schema
}
```

**Never reference another service's schema** in Prisma. Cross-service data goes through GraphQL.

### Migrations

Each service manages its own migrations:

```bash
# Create a new migration (during development)
cd services/auth
npx prisma migrate dev --name add_email_verified

# Apply all pending migrations (CI / production)
make migrate
```

### Redis usage

| Key pattern | Purpose | TTL |
|-------------|---------|-----|
| `ratelimit:{userId}:queries:{minute}` | Per-minute query counter | 60s |
| `session:{userId}` | Active session cache | 24h |
| `subscription:{userId}` | Tier + limits cache | 1h |
| `conversation:{id}:context` | Last N messages for LLM context | 30min |

---

## 8. Authentication Flow

```
1. App calls sendOTP(phone)
      └── auth service → MSG91 → OTP SMS sent

2. App calls verifyOTP(phone, otp)
      └── auth service validates OTP
      └── creates/finds User in DB
      └── returns { accessToken (15min), refreshToken (7 days) }

3. App attaches two headers to every request:
      Authorization: Bearer <accessToken>
      x-profile-id: <activeProfileId>       ← chosen by the client, NOT in JWT

4. Apollo Router validates JWT using JWKS
      └── on success → extracts { userId, tier } from token
      └── forwards as x-user-id, x-user-tier headers
      └── propagates x-profile-id from the client request header as-is

5. Subgraphs read context.userId, context.userTier, context.profileId from headers
```

**Why `x-profile-id` is not in the JWT:** Users have multiple family profiles and can switch between them freely. Embedding `profileId` in the token would require re-issuing a new token on every profile switch. Instead, the client sends the active profile ID as a plain header on each request — no token refresh needed.

**Access token expires in 15 minutes.** The app silently calls `refreshToken(refreshToken)` to get a new one.

---

## 9. LLM Routing

The chat service routes to different models based on the user's subscription tier:

```
FREE   → Gemini 1.5 Flash   (cheapest, good for basic queries)
SILVER → GPT-4o-mini        (better quality, moderate cost)
GOLD   → GPT-4o             (best quality)
Crisis → GPT-4o always      (regardless of tier — safety first)
```

### RAG pipeline (to be implemented)

```
User message
  → embed query (OpenAI / Gemini embeddings)
  → ChromaDB similarity search (collection: symptoms / wellness / health_general)
  → inject top-K results into LLM system prompt
  → LLM generates response
  → safety guardrails (post-processing)
  → store in DB, publish to Redis for subscription
```

### Safety guardrails

Every LLM response must pass through guardrails before being returned:

- **Block:** diagnosis statements, medication dosages, prescription advice
- **Detect:** crisis/suicidal ideation → override response with helpline numbers (iCall, Vandrevala)
- **Append:** standard health disclaimer on every response

---

## 10. Adding a New Feature

### Adding a field to an existing type

1. Add a new file (or edit an existing one) under `src/schema/types/`
2. Add a resolver in the appropriate `src/resolvers/queries/` or `src/resolvers/mutations/` file
3. Export it from the folder's `index.ts` and register in `src/resolvers/index.ts`
4. If DB data is needed, add the Prisma model/column and create a migration
5. Run `make codegen` to regenerate TypeScript types

### Adding a new query or mutation

1. Create `src/schema/queries/<name>.graphql` or `src/schema/mutations/<name>.graphql`
   ```graphql
   type Query {
     myNewQuery(id: ID!): MyType
   }
   ```
2. Create `src/resolvers/queries/<name>.ts` or `src/resolvers/mutations/<name>.ts`
   ```typescript
   export const myNewQuery = async (_: unknown, { id }: { id: string }, ctx: Context) => {
     return myService.getById(id);
   };
   ```
3. Export from the folder's `index.ts` — the schema merger and resolver map pick it up automatically

### Adding a new type to an existing subgraph

1. Create `src/schema/types/<typeName>.graphql`
2. If it needs entity resolution across subgraphs, create `src/resolvers/entities/<TypeName>.ts` with `__resolveReference`
3. Register the entity resolver in `src/resolvers/index.ts`
4. Add Prisma model if needed + migration

### Adding a new domain service

1. Create `src/services/<domain>.service.ts`
2. Export it from `src/services/index.ts`
3. Import and call from the relevant resolver files

### Adding a new subgraph

1. Copy the structure of an existing service under `services/<name>/`
2. Add it to `gateway/supergraph.yaml`
3. Add it to `docker-compose.yml` and `docker-compose.dev.yml`
4. Add a migrate step to `scripts/migrate.sh`
5. `make compose-schema` to recompose the supergraph

---

## 11. Local Dev Reference

### First-time setup

```bash
bash scripts/dev-setup.sh
# → copies .env.example → .env
# → npm install
# → prisma generate (all services)
```

### Daily workflow

```bash
make dev          # everything up with hot reload (tsx --watch)
                  # gateway always recomposes supergraph from live subgraphs

make prod         # composes schema first, then starts everything without hot reload
                  # gateway uses the pre-built supergraph.graphql — rover skipped at startup

make logs service=chat   # tail logs for one service
make down         # stop everything
```

### After changing a GraphQL schema

```bash
make codegen      # regenerate TypeScript types from SDL
# gateway recomposes supergraph automatically on next restart
```

### After adding a Prisma model or column

```bash
# inside the service directory:
npx prisma migrate dev --name describe_the_change

# or via docker compose:
docker compose exec auth npx prisma migrate dev --name describe_the_change
```

### Port map

| Service | Port |
|---------|------|
| GraphQL API (router) | **4000** |
| Router health | 8088 |
| Auth | 4001 |
| Profile | 4002 |
| Commerce | 4003 |
| Chat | 4004 |
| Content | 4005 |
| Coprocessor | 4010 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| ChromaDB | 8000 |

### Useful one-liners

```bash
# Open Prisma Studio for a service
docker compose exec auth npx prisma studio

# Check Redis keys
docker compose exec redis redis-cli keys '*'

# Re-run schema composition manually
make compose-schema

# Run a single service in isolation (infra must be up)
docker compose up auth postgres redis
```
