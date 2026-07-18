# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Reusable, production-ready **NestJS 10** starter (TypeScript). Ships auth, Prisma/PostgreSQL,
validated config, health checks, and structured logging pre-wired so new projects only add
feature modules. Follow the local **`nestjs-best-practices`** skill (`.agents/skills/nestjs-best-practices/`)
for any NestJS code — read the relevant `rules/*.md` before non-trivial decisions. It is reference
material, not an auto-registered Claude Code skill.

## Commands

```bash
npm run start:dev          # watch mode, NODE_ENV=development (primary dev command)
npm run start:prod         # NODE_ENV=production, runs dist/main
npm run build              # compile to dist/ (wipes dist/ first)
npm run lint               # eslint --fix
npm run test               # unit tests (*.spec.ts under src/)
npm run test:e2e           # e2e (test/*.e2e-spec.ts, boots AppModule)
npx jest src/foo.spec.ts   # single unit test file; -t "name" to filter by name

# Prisma (all cross-env NODE_ENV=development unless noted)
npm run prisma:generate    # regenerate @prisma/client — run after editing schema.prisma
npm run prisma:migrate     # create/apply a dev migration
npm run prisma:deploy      # apply migrations in prod (no cross-env)
npm run db:seed            # seed a default ADMIN user
```

## Architecture

Feature-module layout (per skill `arch-feature-modules`). Each module owns its controller,
service, DTOs; only exports what others need.

- **`src/config/`** — `registerAs` namespaces (`app`, `database`, `jwt`) + `validation.schema.ts`
  (Joi). Loaded by `ConfigModule.forRoot({ isGlobal, load, validationSchema })` in `app.module.ts`.
  Access config via `ConfigService.get('app.port')` etc. **The app fails fast at boot if env is invalid.**
- **`src/prisma/`** — `@Global()` `PrismaModule` exporting `PrismaService` (extends `PrismaClient`,
  connects/disconnects on lifecycle hooks). Inject `PrismaService` anywhere without importing the module.
- **`src/auth/`** — access + refresh JWT. `AuthService` handles register/login/refresh/logout with
  refresh-token **rotation + family reuse detection** (`RefreshToken` table). Passport `local`
  strategy backs login; `jwt` strategy backs everything else.
- **`src/users/`** — `UsersService` (exported; `AuthModule` depends on it). Response uses
  `UserResponseDto` with `@Exclude()` on `passwordHash`.
- **`src/health/`** — terminus liveness (`/api/health/live`) + readiness (`/api/health/ready`,
  custom `PrismaHealthIndicator` running `SELECT 1`).
- **`src/common/`** — shared enums (`UserRole` re-exported from `@prisma/client`) and the global
  `AllExceptionsFilter`.

### Cross-cutting globals (know these before adding routes)

- **Secure by default.** `JwtAuthGuard` + `RolesGuard` are registered as `APP_GUARD` in
  `app.module.ts`. Every route requires a valid Bearer token unless decorated `@Public()`.
  Role-gate with `@Roles(UserRole.ADMIN)` (RolesGuard is global — no `@UseGuards` needed).
  Get the caller with `@CurrentUser()`.
- **Routing.** Global prefix `api` + URI versioning → controllers use
  `@Controller({ path: '...', version: '1' })`, giving `/api/v1/...`. Health is `VERSION_NEUTRAL`
  → `/api/health/...`.
- **Validation/serialization.** Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`,
  `transform`) validates all input DTOs; global `ClassSerializerInterceptor` applies response
  serialization. Return class instances (e.g. `new UserResponseDto(user)`) for `@Exclude()` to take effect.
- **Errors.** Throw `HttpException` subclasses (e.g. `ConflictException`) from services;
  `AllExceptionsFilter` normalizes them to a consistent JSON body and logs via pino.
- **Logging.** `nestjs-pino` is the app logger (`app.useLogger(app.get(Logger))`). Use injected
  pino `Logger`, not `console.*`. Auth headers and passwords are redacted.

## Conventions / gotchas

- **`UserRole` comes from Prisma.** Import from `src/common/enums/user-role.enum.ts`
  (re-exports `@prisma/client`) so roles never drift from the DB schema.
- **After changing `prisma/schema.prisma`**, run `npm run prisma:generate` or types/`@prisma/client`
  imports will be stale, and `npm run prisma:migrate` to update the DB.
- **Env files:** only `.env.example` + `.env.development` are committed; `.env.staging`/`.env.production`
  are git-ignored. `ConfigModule` loads `.env.${NODE_ENV}` then `.env`.
- **Two Jest setups:** unit config inlined in `package.json` (`rootDir: src`, `*.spec.ts`); e2e in
  `test/jest-e2e.json` (`*.e2e-spec.ts`).
- **Loose TypeScript:** `tsconfig.json` has `strictNullChecks`/`noImplicitAny` **off** — strict-mode
  bugs pass silently; be deliberate about null handling.
