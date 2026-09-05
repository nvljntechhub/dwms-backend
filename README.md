# DWMS Backend

Backend API for **DWMS (Dealers Warehouse Management System)** — a NestJS service for authentication, users, and addresses.

**Base URL:** `http://localhost:5001/api/v1`  
**Postman:** [`postman/DWMS-Backend.postman_collection.json`](postman/DWMS-Backend.postman_collection.json)

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Framework | NestJS 10 (Express) |
| Language | TypeScript |
| Database | PostgreSQL 15 + TypeORM |
| Cache / tokens | Redis (ioredis) |
| Auth | JWT (access + refresh), bcrypt, argon2 |
| Mail | Gmail SMTP via `@nestjs-modules/mailer` + Handlebars |
| Config | `@nestjs/config` → `.env.${NODE_ENV}` |

---

## Prerequisites

- Node.js 18+ and npm
- Docker & Docker Compose (for Postgres and Redis)

---

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Environment

Create `.env.development` in the project root (gitignored). Example aligned with `docker-compose.yml`:

```env
PORT=5001
NODE_ENV=development

DB_HOST=localhost
DB_USERNAME=user
DB_PASSWORD=password123
DB_DATABASE=dwms_db

REDIS_HOST=localhost
REDIS_PORT=6380

FRONTEND_URL=http://localhost:3000

ACCESS_TOKEN_SECRET=change-me-access
REFRESH_TOKEN_SECRET=change-me-refresh
EMAIL_VERIFICATION_SECRET=change-me-email

ACCESS_TOKEN_EXPIRED_IN=15m
REFRESH_TOKEN_EXPIRED_IN=7d
EMAIL_VERIFICATION_EXPIRED_IN=15m

SENDER_EMAIL=your-gmail@gmail.com
SENDER_EMAIL_PASSWORD=your-app-password

HASH_SALT_ROUNDS=10
```

The app loads `.env.${NODE_ENV || 'development'}`.

### 3. Start infrastructure

```bash
docker compose up -d
```

| Service | Host port | Credentials / notes |
|---------|-----------|---------------------|
| Postgres | `5432` | DB `dwms_db`, user `user`, password `password123` |
| Redis | `6380` | No password; maps to container `6379` |

### 4. Run migrations

```bash
npm run migration:run
```

Migrations live under `src/migrations/` and run against the built `dist/` output via `data-source.ts`. Schema sync is **off** (`synchronize: false`).

### 5. Start the API

```bash
# development (watch mode)
npm run start:dev

# one-shot
npm run start

# production
npm run build && npm run start:prod
```

API listens on `PORT` (default `5001`) with global prefix `api/v1`.

---

## Project structure

```
src/
  auth/              # Login, register-dealer, logout, email verification
  users/             # User entity + create endpoint
  dealers/           # Dealer (tenant) entity
  warehouses/        # Warehouse entity (default "Main Warehouse" on register)
  user-addresses/    # Address entity + CRUD scaffold
  mail/              # Mailer + Handlebars templates
  redis/             # Redis module
  migrations/        # TypeORM migrations
  config/            # ORM + hash config
  common/utils/      # BaseEntity, ApiResponse, enums
  main.ts            # Bootstrap (cookies, CORS, prefix)
data-source.ts       # TypeORM CLI DataSource
docker-compose.yml
postman/
```

**Modules:** `UsersModule`, `AuthModule`, `MailModule`, `UserAddressesModule`, `RedisModule`, `DealersModule`, `WarehousesModule`.

---

## Architecture notes

- **CORS:** `origin` = `FRONTEND_URL`, `credentials: true` (required for cookie auth).
- **Cookies:** `cookie-parser` enabled; tokens are set as httpOnly cookies (not returned in JSON).
- **Response shape (auth):**

```json
{
  "statusCode": 200,
  "message": "...",
  "data": {}
}
```

- **Validation:** DTOs use `class-validator`, but a global `ValidationPipe` is not registered yet — validation may not run until it is added in `main.ts`.
- **Auth guards:** No route guards are wired yet; endpoints are currently public.

---

## Authentication

### Flow overview

```
POST /auth/register-dealer
  → DB transaction: dealer → SUPER_ADMIN user → default "Main Warehouse"
  → JWT (sub, dealerId, role) + httpOnly cookies
  → client can go to the admin dashboard
     ↓
  Login → same cookies / JWT shape
     ↓     Redis stores argon2(hash of refresh JWT)
  Logout → delete Redis key + clear cookies
```

| Cookie | Purpose | Default max-age |
|--------|---------|-----------------|
| `access_token` | Short-lived access JWT | `ACCESS_TOKEN_EXPIRED_IN` (`15m`) |
| `refresh_token` | Long-lived refresh JWT | `REFRESH_TOKEN_EXPIRED_IN` (`7d`) |

Cookie flags:

- Development: `httpOnly`, `secure: false`, `sameSite: lax`
- Production (`NODE_ENV=production`): `httpOnly`, `secure: true`, `sameSite: none`

Redis key for refresh sessions: `refresh:user:{userId}` (value = argon2 hash of the refresh token).

### Email verification

Email verification is still available via `POST /auth/verifyEmail`. Dealer registration logs the first admin in immediately (`isVerified: true`) so they can go to the dashboard without waiting on email.

### Not yet exposed over HTTP

- None for auth token refresh — `POST /auth/refresh` reads the `refresh_token` cookie and sets new auth cookies.
- Password reset (message stubs only)

---

## API reference

All paths are under `/api/v1`.

### Auth — `POST /auth/register-dealer`

Creates a dealer, the first user (`SUPER_ADMIN`), and a default `"Main Warehouse"` in one DB transaction. Issues a JWT that includes `dealerId` and sets auth cookies so the client can go to the admin dashboard. Addresses are collected later in-app.

**Body (`RegisterDto`):**

| Field | Type | Required |
|-------|------|----------|
| `firstName` | string | Yes |
| `lastName` | string | Yes |
| `email` | string (email) | Yes |
| `password` | string | Yes |
| `phoneNumber` | string | No |
| `profileURL` | string | No |
| `dealer` | `CreateDealerDto` | Yes |

**Dealer object:**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | Yes |
| `email` | string (email) | Yes |
| `taxId` | string | No |

**Response:** `201` — `ApiResponse` with `{ id, firstName, lastName, name, email, role, dealerId, warehouse }`. Sets `access_token` and `refresh_token` cookies. JWT payload: `{ sub, dealerId, role }`. Conflicts on duplicate email/phone/dealer email → `409`.

---

### Auth — `POST /auth/login`

**Body (`SignInDto`):**

```json
{
  "email": "john.doe@example.com",
  "password": "Password123!"
}
```

**Response:** `200` — `ApiResponse` with `{ id, firstName, lastName, name, email, role, dealerId }`. Sets `access_token` and `refresh_token` cookies. JWT payload: `{ sub, dealerId, role }`.

---

### Auth — `POST /auth/logout`

Reads `refresh_token` cookie, removes the Redis session, clears auth cookies.

**Response:** `200` — success message.

---

### Auth — `POST /auth/verifyEmail`

**Body (`VerifyEmailDto`):**

```json
{
  "token": "<email-verification-jwt>"
}
```

**Response:** `200` — `ApiResponse` with verified user (`isVerified: true`).

---

### Users — `POST /users`

Creates a user via `CreateUserDto` (same shape as register). Does **not** send a verification email. Returns the raw `User` entity (not wrapped in `ApiResponse`).

---

### User addresses — scaffold

| Method | Path | Status |
|--------|------|--------|
| `POST` | `/user-addresses` | Stub |
| `GET` | `/user-addresses` | Stub |
| `GET` | `/user-addresses/:id` | Stub |
| `PATCH` | `/user-addresses/:id` | Stub |
| `DELETE` | `/user-addresses/:id` | Stub |

---

## Data model

Full schema, ERD, FKs, and migration order: [`docs/database-architecture.md`](docs/database-architecture.md).

### `user`

| Column | Notes |
|--------|--------|
| `id` | UUID |
| `firstName`, `lastName` | Required |
| `email`, `phoneNumber` | Unique |
| `password` | Hashed (bcrypt); not selected by default |
| `profileURL` | Optional |
| `joinedDate` | Set on insert if missing |
| `role` | `SUPER_ADMIN`, `ADMIN`, `WAREHOUSE_MANAGER`, `STAFF`, `DRIVER`; default `STAFF` |
| `isVerified` | Default `false` (dealer registration sets `true`) |
| `dealer_id` | FK → `dealers` |
| `createdAt`, `updatedAt` | Timestamps |
| `addresses` | One-to-many → `user_address` |

### `dealers`

| Column | Notes |
|--------|--------|
| `id` | UUID |
| `name`, `email` | Required; email unique |
| `tax_id` | Optional |
| `status` | `ACTIVE`, `SUSPENDED`, `INACTIVE` |

### `warehouses`

| Column | Notes |
|--------|--------|
| `id` | UUID |
| `name` | Required; default `"Main Warehouse"` on dealer register |
| `is_default` | Default `false` |
| `dealer_id` | FK → `dealers` (cascade delete) |

### `user_address`

| Column | Notes |
|--------|--------|
| `id` | UUID |
| `user_id` | FK → `user` |
| `label`, `street`, `city`, `state`, `postalCode`, `country` | Required |
| `isDefault` | Default `false` |

### Migrations (order)

1. `CreateUsers`
2. `Adding_UserRole`
3. `adding_user_addresses`
4. `AddingUserIsVerified`

---

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Dev server with watch |
| `npm run start` | Start once |
| `npm run start:prod` | Run compiled `dist/main` |
| `npm run build` | Compile TypeScript |
| `npm run migration:run` | Build + apply migrations |
| `npm run migration:revert` | Build + revert last migration |
| `npm run migration:generate -- src/migrations/Name` | Generate from entity diff |
| `npm run migration:create -- src/migrations/Name` | Empty migration file |
| `npm run test` | Unit tests |
| `npm run test:e2e` | E2E tests |
| `npm run lint` | ESLint |

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | Selects env file; cookie security mode |
| `PORT` | HTTP port |
| `FRONTEND_URL` | CORS origin + verification link base |
| `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | Postgres (port fixed at `5432`) |
| `REDIS_HOST`, `REDIS_PORT` | Redis |
| `ACCESS_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRED_IN` | Access JWT |
| `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRED_IN` | Refresh JWT + Redis TTL |
| `EMAIL_VERIFICATION_SECRET`, `EMAIL_VERIFICATION_EXPIRED_IN` | Email verification JWT |
| `SENDER_EMAIL`, `SENDER_EMAIL_PASSWORD` | Gmail SMTP (use an [App Password](https://support.google.com/accounts/answer/185833)) |
| `HASH_SALT_ROUNDS` | bcrypt cost (default `10`) |

---

## Mail setup

Emails are sent through Gmail SMTP (`smtp.gmail.com`).

1. Enable 2FA on the Google account.
2. Create an App Password and set `SENDER_EMAIL` / `SENDER_EMAIL_PASSWORD`.
3. Templates: `src/mail/templates/email-verification.hbs`, `src/mail/templates/password-reset.hbs`.

Forgot-password still sends email. Dealer registration does not wait on mail — it logs the admin in immediately.

---

## Local development checklist

1. `docker compose up -d` — Postgres + Redis healthy  
2. `.env.development` present and matching compose ports  
3. `npm run migration:run`  
4. `npm run start:dev`  
5. Hit `POST http://localhost:5001/api/v1/auth/register-dealer`  
6. (Optional) Import the Postman collection — note some collection paths may lag behind the controller (`login` / `verifyEmail` vs older names)

---

## Current scope & gaps

**Implemented:** register, login (cookie-based), logout, email verification, user create, address entity + scaffold routes.

**Not finished:** HTTP token refresh, password reset, auth guards on protected routes, global `ValidationPipe`, full user-address CRUD, warehouse/order domain modules (enums exist as foreshadowing only).
