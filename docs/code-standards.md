# Nova — Code Standards & Best Practices

> These standards apply to all code in this repository. When in doubt, optimise for **readability and explicitness** over cleverness.

---

## Table of Contents

1. [TypeScript](#1-typescript)
2. [File & Folder Naming](#2-file--folder-naming)
3. [GraphQL SDL](#3-graphql-sdl)
4. [Resolvers](#4-resolvers)
5. [Service Layer (Business Logic)](#5-service-layer-business-logic)
6. [Prisma & Database](#6-prisma--database)
7. [Error Handling](#7-error-handling)
8. [Logging](#8-logging)
9. [Environment & Config](#9-environment--config)
10. [Git Workflow](#10-git-workflow)
11. [What Not To Do](#11-what-not-to-do)

---

## 1. TypeScript

### Strict mode is non-negotiable

All packages extend `tsconfig.base.json` which has `"strict": true`. Do not disable strict checks per-file.

### Prefer explicit types on public boundaries

```typescript
// ✅ good — return type is explicit
async function getUser(id: string): Promise<User | null> { ... }

// ❌ bad — caller has to infer
async function getUser(id: string) { ... }
```

Internal implementation details can rely on inference.

### Use `unknown` over `any`

```typescript
// ✅
async function parseWebhook(body: unknown): Promise<RazorpayEvent> {
  // validate before casting
}

// ❌
async function parseWebhook(body: any) { ... }
```

If you genuinely need `any`, add a comment explaining why.

### Prefer `interface` for object shapes, `type` for unions and aliases

```typescript
// ✅
interface UserProfile {
  id: string;
  name: string;
}

type SubscriptionTier = 'FREE' | 'SILVER' | 'GOLD';
```

### Async/await over `.then()` chains

```typescript
// ✅
const user = await prisma.user.findUnique({ where: { id } });

// ❌
prisma.user.findUnique({ where: { id } }).then((user) => { ... });
```

### No unused variables — use `_` prefix to suppress

```typescript
// ✅
async function logout(_parent: unknown, _args: unknown, ctx: Context) {
  await sessionService.revoke(ctx.userId!);
}
```

---

## 2. File & Folder Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | `camelCase.ts` | `otp.service.ts` |
| Folders | `camelCase` | `resolvers/`, `queries/` |
| GraphQL files | `camelCase.graphql` | `sendOTP.graphql`, `user.graphql` |
| Prisma schema | `schema.prisma` | fixed name per service |
| Types/interfaces | `PascalCase` | `interface UserProfile` |
| Functions | `camelCase` | `buildContext()` |
| Constants | `SCREAMING_SNAKE_CASE` | `MESSAGE_LIMITS` |
| Env vars | `SCREAMING_SNAKE_CASE` | `JWT_SECRET` |

### Schema folder structure

Split SDL across files by concern — one file per type group, one file per operation:

```
src/schema/
├── index.ts              # merges all .graphql files — do not edit
├── base.graphql          # federation @link + shared scalars only
├── types/
│   ├── user.graphql      # type User @key(...)
│   └── profile.graphql   # type Profile @key(...)
├── queries/
│   └── me.graphql        # type Query { me: User }
└── mutations/
    ├── sendOTP.graphql    # type Mutation { sendOTP(...): OTPResponse! }
    └── verifyOTP.graphql  # type Mutation { verifyOTP(...): AuthPayload! }
```

Each `queries/` and `mutations/` file declares `type Query {}` or `type Mutation {}` — `mergeTypeDefs` merges them correctly.

### Resolver folder structure

One file per operation — not one file per GraphQL type:

```
src/resolvers/
├── index.ts              # assembles the final resolver map
├── queries/
│   ├── me.ts             # export const me = ...
│   └── index.ts          # export const Query = { me }
├── mutations/
│   ├── sendOTP.ts
│   ├── verifyOTP.ts
│   └── index.ts          # export const Mutation = { sendOTP, verifyOTP, ... }
└── entities/
    └── User.ts           # __resolveReference + field resolvers for User
```

### Service file naming

One file per **domain concern**, named `<domain>.service.ts`:

```
src/services/
├── index.ts              # re-exports all services
├── otp.service.ts        # ✅ OTP send, verify, rate-limit logic
├── session.service.ts    # ✅ token creation, refresh, revocation
└── user.service.ts       # ✅ user lookup, creation, status updates
```

Do not put everything in one `authService.ts`. Split by domain — each file should own one cohesive concern.

---

## 3. GraphQL SDL

The `.graphql` files are the **source of truth** for each subgraph. The TypeScript types in `generated/types.ts` are derived from them — never the other way around.

### Federation directives go in `base.graphql`

```graphql
# src/schema/base.graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.7", import: ["@key", "@external"])

scalar DateTime
```

### Each query/mutation gets its own file

```graphql
# src/schema/mutations/sendOTP.graphql
type Mutation {
  sendOTP(phone: String!, countryCode: String): OTPResponse!
}
```

This keeps diffs small and avoids merge conflicts when multiple people add mutations simultaneously.

### Use non-null `!` intentionally

```graphql
# ✅ — name will always be present
name: String!

# ✅ — email is genuinely optional
email: String

# ❌ — don't make everything non-null by default, think about it
```

### Inputs for mutations, not inline args

```graphql
# ✅
type Mutation {
  createProfile(input: CreateProfileInput!): Profile!
}

input CreateProfileInput {
  name: String!
  dateOfBirth: Date!
  gender: Gender!
}

# ❌ — hard to extend later, messy at call site
type Mutation {
  createProfile(name: String!, dateOfBirth: Date!, gender: Gender!): Profile!
}
```

### Enums and scalars go in `types/` files

Put `enum` and `scalar` declarations in the relevant type file, not scattered across query/mutation files.

### Add a description for any non-obvious field

```graphql
type TierLimits {
  dailyMessages: Int!   # -1 means unlimited
  maxProfiles: Int!
}
```

---

## 4. Resolvers

Resolvers are **thin**. Their only job is to call a service function and return the result. Business logic, DB queries, and external API calls belong in `services/`.

### Resolver structure

```typescript
// src/resolvers/mutations/createProfile.ts

import { profileService } from '../../services';
import type { Context } from '../../context';

export const createProfile = async (
  _: unknown,
  { input }: { input: CreateProfileInput },
  ctx: Context,
) => {
  if (!ctx.userId) throw new AuthenticationError();
  return profileService.create(ctx.userId, input);
};
```

```typescript
// src/resolvers/mutations/index.ts
import { createProfile } from './createProfile';
import { updateProfile } from './updateProfile';

export const Mutation = { createProfile, updateProfile };
```

```typescript
// src/resolvers/index.ts
import { Query }   from './queries';
import { Mutation } from './mutations';
import { User }    from './entities/User';

export const resolvers = { Query, Mutation, User };
```

### Always check authentication before acting

```typescript
// ✅
if (!ctx.userId) throw new AuthenticationError();
```

### `__resolveReference` must always be implemented for `@key` types

```typescript
// src/resolvers/entities/User.ts
export const User = {
  __resolveReference: async ({ id }: { id: string }) => ({ id }),

  profiles: async ({ id }: { id: string }) => {
    return profileService.getByUser(id);
  },
};
```

If it's not implemented, federation will silently return `null` for cross-subgraph queries.

### Resolver files export named objects, not default exports

```typescript
// ✅
export const Query = { ... };
export const Mutation = { ... };

// ❌
export default { ... };
```

---

## 5. Service Layer (Business Logic)

All business logic lives in `src/services/<domain>.service.ts`. This layer:
- Owns DB queries (via Prisma)
- Calls external APIs (LLM, Razorpay, MSG91)
- Handles caching (Redis reads/writes)
- Throws typed errors from `@nova/shared`

### Structure

```typescript
// src/services/otp.service.ts
export const otpService = {
  async send(phone: string): Promise<void> {
    // implementation
  },

  async verify(phone: string, otp: string): Promise<boolean> {
    // implementation
  },
};
```

Export a plain object, not a class. Keep it simple.

### Re-export from `services/index.ts`

```typescript
// src/services/index.ts
export { otpService }     from './otp.service';
export { sessionService } from './session.service';
export { userService }    from './user.service';
```

Resolvers always import from `'../../services'`, never directly from a service file.

### Services never import from resolvers

The dependency direction is always: `resolver → service → prisma/redis/external API`.

### Validate input at the service boundary

Use `zod` for runtime validation of external inputs (webhooks, user-supplied data):

```typescript
import { z } from 'zod';

const CreateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  dateOfBirth: z.string().datetime(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
});

async function create(userId: string, input: unknown) {
  const data = CreateProfileSchema.parse(input); // throws ZodError if invalid
  // proceed with validated data
}
```

---

## 6. Prisma & Database

### One schema per service — never cross-query

Each service's Prisma client only knows about its own PostgreSQL schema. If service A needs data from service B, it goes through GraphQL — never through a direct DB query.

```typescript
// ❌ never do this in commerce service
const userProfiles = await prisma.$queryRaw`SELECT * FROM profile.profiles WHERE user_id = ${userId}`;
```

### Always use Prisma's typed client — no raw SQL for business logic

```typescript
// ✅
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, phone: true, status: true },
});

// ❌ avoid unless absolutely necessary
const user = await prisma.$queryRaw`SELECT id, phone FROM auth.users WHERE id = ${userId}`;
```

### Select only what you need

```typescript
// ✅ — only fetches needed columns
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, phone: true },
});

// ❌ — fetches everything including sessions, otpRequests
const user = await prisma.user.findUnique({ where: { id } });
```

### Use `findUnique` for lookups by unique field, `findFirst` for everything else

### Map Prisma errors to domain errors

```typescript
import { Prisma } from '@prisma/client';
import { ValidationError } from '@nova/shared';

try {
  await prisma.user.create({ data: { phone } });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw new ValidationError('Phone number already registered');
  }
  throw e;
}
```

### Migration naming convention

```bash
npx prisma migrate dev --name <verb>_<description>

# examples:
# add_email_to_users
# remove_otp_attempts_column
# create_wellness_insights_table
```

---

## 7. Error Handling

### Use typed errors from `@nova/shared`

```typescript
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from '@nova/shared';

// In a resolver or service:
if (!ctx.userId)   throw new AuthenticationError();
if (!isOwner)      throw new AuthorizationError('You do not own this profile');
if (!profile)      throw new NotFoundError('Profile');
if (count > limit) throw new RateLimitError();
```

Apollo Server surfaces these as GraphQL errors with the appropriate `code` extension. The client can check `error.extensions.code` to handle them.

### Never throw raw strings

```typescript
// ❌
throw new Error('user not found');

// ✅
throw new NotFoundError('User');
```

### Never swallow errors silently

```typescript
// ❌
try {
  await doSomething();
} catch (_e) {
  // nothing — now you have a ghost bug
}

// ✅
try {
  await doSomething();
} catch (e) {
  logger.error('doSomething failed', { error: e, context: { userId } });
  throw e; // or wrap in a domain error
}
```

### REST webhook endpoints always return 200 to the caller

External services (Razorpay, Firebase) retry on non-2xx. Validate the payload internally but acknowledge receipt immediately:

```typescript
app.post('/webhooks/razorpay', async (req, res) => {
  res.json({ received: true }); // acknowledge immediately

  try {
    await paymentService.handleWebhook(req.body, req.headers);
  } catch (e) {
    logger.error('Razorpay webhook processing failed', { error: e });
  }
});
```

---

## 8. Logging

Always use the shared `logger` — never `console.log` / `console.error`.

```typescript
import { logger } from '@nova/shared';

// ✅ structured logging with context
logger.info('User created', { userId, phone: maskedPhone });
logger.warn('OTP attempt limit reached', { phone });
logger.error('LLM call failed', { error: e, model, userId });

// ❌
console.log('user created');
console.error(e);
```

### Log levels

| Level | When to use |
|-------|-------------|
| `error` | Something failed and needs attention |
| `warn` | Unusual but handled (rate limit hit, invalid OTP) |
| `info` | Normal lifecycle events (service started, user created) |
| `debug` | Detailed tracing — only in development |

### Never log sensitive data

```typescript
// ❌
logger.info('OTP verified', { phone, otp, jwtSecret });

// ✅
logger.info('OTP verified', { phone: maskPhone(phone) });
```

Mask or omit: OTPs, JWT tokens, passwords, full phone numbers, payment details.

---

## 9. Environment & Config

### All config comes from environment variables

No hardcoded URLs, secrets, or credentials anywhere in code.

```typescript
// ✅
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET is required');

// ❌
const jwtSecret = 'my-secret-key';
```

### Validate required env vars at startup

Fail fast — crash on boot if required config is missing rather than failing mid-request:

```typescript
// src/index.ts
const REQUIRED_ENV = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

### Never commit `.env`

`.env` is in `.gitignore`. Use `.env.example` to document all variables (with empty values for secrets).

---

## 10. Git Workflow

### Branch naming

```
feature/<short-description>     # new functionality
fix/<short-description>         # bug fix
chore/<short-description>       # maintenance, deps, tooling
docs/<short-description>        # documentation only
```

Examples: `feature/otp-verification`, `fix/rate-limit-gold-tier`, `chore/update-prisma`

### Commit messages — Conventional Commits

Format: `<type>(<scope>): <short summary>`

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Deps, tooling, config |
| `docs` | Documentation only |
| `refactor` | Code change without behaviour change |
| `test` | Adding or fixing tests |

```
feat(auth): implement OTP verification with MSG91
fix(chat): correct daily message limit check for SILVER tier
chore(deps): upgrade prisma to 6.2.0
docs(arch): update subgraph port map
```

### Pull requests

- One PR per feature/fix — keep them small and reviewable
- Include a short description of **what** and **why**, not just **what**
- All TODO comments added in a PR should have a linked issue or be resolved in the same PR

### Never push directly to `main`

All changes go through a PR with at least one review.

---

## 11. What Not To Do

### Do not put everything in one service file

Split `src/services/` by domain concern. `otp.service.ts`, `session.service.ts`, `user.service.ts` — not one big `authService.ts`. Each file owns one cohesive responsibility.

### Do not put everything in one schema file

Split `src/schema/` across `types/`, `queries/`, `mutations/`. One file per type or operation group. This avoids merge conflicts and keeps diffs reviewable.

### Do not bypass the GraphQL layer for cross-service data

Services communicate via GraphQL. Never import one service's Prisma client into another service.

### Do not put business logic in resolvers

Resolvers call services. Services contain logic. Keep them separate so services can be tested independently.

### Do not use `console.log`

Use `logger` from `@nova/shared`. Structured logs are queryable in production.

### Do not ignore TypeScript errors with `@ts-ignore`

Fix the root cause. If a third-party type is genuinely wrong, use `@ts-expect-error` with a comment explaining why.

### Do not store secrets in code or comments

No API keys, JWT secrets, passwords, or credentials anywhere in the codebase — not even in comments.

### Do not add a TODO without context

```typescript
// ❌
// TODO: fix this

// ✅
// TODO: implement OTP rate limiting — max 3 attempts per phone per 10 min
```

### Do not return raw Prisma models from resolvers

Prisma models may include fields you don't want to expose. Use `select` to only fetch what's needed.

```typescript
// ❌ — may expose internal fields
return await prisma.user.findUnique({ where: { id } });

// ✅ — explicit about what gets returned
return await prisma.user.findUnique({
  where: { id },
  select: { id: true, phone: true, status: true, createdAt: true },
});
```

### Do not skip the health endpoint

Every service must have `GET /health` returning `{ status: 'ok' }`. The gateway will not start without it.
