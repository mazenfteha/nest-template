# NestJS Starter Template

A reusable, production-ready NestJS 10 starter. Clone it and start adding business logic — the infrastructure is already wired following the `nestjs-best-practices` skill.

## What's included

- **Prisma + PostgreSQL** — `User`, `Admin`, `RefreshToken` base tables (`UserRole` enum: `USER` / `ADMIN`).
- **Auth module** — JWT **access + refresh** tokens with rotation and family-based reuse detection, `bcrypt` hashing, passport local + jwt strategies.
- **Authorization** — global `JwtAuthGuard` (secure-by-default) + `RolesGuard`, with `@Public()`, `@Roles()`, `@CurrentUser()` decorators.
- **Global config** — `@nestjs/config` with a **Joi** schema that fails fast on bad/missing env vars.
- **Environment separation** — `cross-env` drives `development` / `staging` / `production`; each loads `.env.<NODE_ENV>` then `.env`.
- **Bootstrap** — pino structured logging, global exception filter, `/api` prefix, URI versioning (`/api/v1`), global `ValidationPipe` + `ClassSerializerInterceptor`, CORS, graceful shutdown.
- **Health checks** — `@nestjs/terminus` liveness + readiness probes.

## Prerequisites

- Node.js 18+
- A PostgreSQL database
- Nest CLI (for scaffolding): `npm i -g @nestjs/cli` (or use `npx nest ...`)

## Start a new project from this template

Pick whichever fits your workflow:

**A. GitHub "Use this template"** — if this repo lives on GitHub, click **Use this template → Create a new repository**, then clone your new repo.

**B. Degit (clone without git history)** — starts a clean history:

```bash
npx degit <owner>/<this-repo> my-app
cd my-app
git init && git add -A && git commit -m "chore: init from nest-template"
```

**C. Plain clone** — then detach from this template's history:

```bash
git clone <this-repo-url> my-app
cd my-app
rm -rf .git && git init        # drop template history, start fresh
```

After obtaining the code, make it yours before installing:

```bash
# 1. Rename the project
#    - package.json  -> "name": "my-app"
#    - .env.development / .env.example -> set DATABASE_URL db name (e.g. my_app)

# 2. Reset migrations for your own domain (optional but recommended)
rm -rf prisma/migrations        # start migration history from scratch

# 3. Install & bootstrap (see Setup below)
npm install
```

Then follow **Setup**. On first migrate, Prisma creates a fresh initial migration for your schema.

## Setup

```bash
npm install

# 1. Configure environment
cp .env.example .env.development   # .env.development is already committed with local defaults
# edit DATABASE_URL / JWT_ACCESS_SECRET as needed

# 2. Generate the Prisma client + create tables
npm run prisma:generate
npm run prisma:migrate             # creates/updates tables in dev

# 3. (optional) seed a default admin
npm run db:seed
```

## Running

```bash
npm run start:dev        # watch mode, NODE_ENV=development
npm run start:staging    # NODE_ENV=staging (expects dist/ built)
npm run start:prod       # NODE_ENV=production
npm run build            # compile to dist/
```

The server listens on `PORT` (default `3000`).

## Environment variables

Validated at boot by `src/config/validation.schema.ts` — the app won't start if any required var is missing/invalid.

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | no | `development` | `development` \| `staging` \| `production` \| `test` |
| `PORT` | no | `3000` | |
| `API_PREFIX` | no | `api` | Global route prefix |
| `CORS_ORIGINS` | no | `*` | Comma-separated origins, or `*` |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | **yes** | — | Min 32 chars |
| `JWT_ACCESS_EXPIRES_IN` | no | `15m` | Access-token lifetime |
| `JWT_REFRESH_EXPIRES_DAYS` | no | `7` | Refresh-token lifetime (days) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | no | `admin@example.com` / `ChangeMe123!` | Used by `npm run db:seed` |

Only `.env.example` and `.env.development` are committed. Create `.env.staging` / `.env.production` from the example at deploy time (they are git-ignored); in real deployments inject secrets via the host's environment, which overrides file values.

> **Adding a new env variable** (e.g. an S3 key)? Follow the step-by-step config workflow in
> [`docs/configuration.md`](docs/configuration.md) — validate (Joi) → namespace (`registerAs`) →
> load in `app.module` → set in env files → consume type-safely.

## API surface

Auth is public where marked; everything else requires a `Bearer` access token by default.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/auth/register` | public | Register (`role` optional, defaults `USER`) |
| `POST` | `/api/v1/auth/login` | public | Email + password → access + refresh tokens |
| `POST` | `/api/v1/auth/refresh` | public | Rotate refresh token → new token pair |
| `POST` | `/api/v1/auth/logout` | bearer | Revoke a refresh token |
| `GET`  | `/api/v1/users/me` | bearer | Current user's profile |
| `GET`  | `/api/v1/users` | bearer + `ADMIN` | List users (role-gated example) |
| `GET`  | `/api/health/live` | public | Liveness probe |
| `GET`  | `/api/health/ready` | public | Readiness probe (DB check) |

## Generating modules with the Nest CLI

Use the Nest CLI to scaffold feature building blocks. Run commands from the project root
(prefix with `npx ` if the CLI isn't installed globally).

```bash
# Scaffold a whole CRUD-less feature at once (module + controller + service):
nest g resource products          # choose "REST API"; skip generating CRUD entry points if you prefer

# Or generate pieces individually:
nest g module products            # src/products/products.module.ts (auto-imported into AppModule)
nest g controller products        # src/products/products.controller.ts (+ .spec.ts)
nest g service products           # src/products/products.service.ts (+ .spec.ts)

# Nest the feature under a folder:
nest g module modules/orders
nest g service modules/orders

# Preview what a command creates without writing files:
nest g service products --dry-run

# Skip the generated *.spec.ts test file:
nest g service products --no-spec
```

Notes specific to this template:

- `nest g module <name>` automatically adds the module to `AppModule.imports` — verify the
  import landed where you want (feature-module organization, per the skill).
- The CLI does **not** create DTOs or Prisma models. Add DTOs under `src/<name>/dto/` with
  `class-validator` decorators, and add models to `prisma/schema.prisma` then run
  `npm run prisma:generate` + `npm run prisma:migrate`.
- Config lives in `nest-cli.json` (`sourceRoot: src`, `deleteOutDir: true`).

## Wiring a generated module into the template's conventions

After scaffolding, follow these steps so the new module matches the rest of the app:

1. **Version the routes.** Use `@Controller({ path: '<name>', version: '1' })` → served at `/api/v1/<name>`.
2. **Auth is on by default.** The global `JwtAuthGuard` protects every route. Add `@Public()` to
   opt a route out, and `@Roles(UserRole.ADMIN)` (with the global `RolesGuard`) to gate by role.
   Grab the caller with `@CurrentUser()`.
3. **Inject `PrismaService`** directly (the `PrismaModule` is `@Global()`), or wrap DB access in a
   repository class for complex queries.
4. **Validate input** with a DTO (`class-validator`); **shape output** with a response DTO using
   `@Exclude()`/`@Expose()` so the global serializer never leaks sensitive fields.
5. **Export** from the module only what other modules need (`exports: [...]`).
6. **Throw `HttpException` subclasses** (e.g. `NotFoundException`) from services — the global
   `AllExceptionsFilter` turns them into the consistent JSON error shape.

Use the existing `users` module as a reference implementation.

## Tests

```bash
npm run test       # unit
npm run test:e2e   # e2e (boots AppModule)
npm run test:cov   # coverage
```
