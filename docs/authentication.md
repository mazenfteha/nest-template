# Authentication & Authorization

How auth works in this template, how to use it day-to-day, how to add roles, and how to reuse the
whole system in any other project.

- **Authentication (authN)** — *who are you?* Verifying identity (login, validating a JWT).
- **Authorization (authZ)** — *what are you allowed to do?* Enforcing roles/permissions on a route.

The design is **secure-by-default**: every route requires a valid access token unless explicitly
marked `@Public()`, and role checks are declarative via `@Roles(...)`.

---

## 1. Components

| File | Responsibility |
|------|----------------|
| `src/auth/auth.service.ts` | Register, login, refresh (rotation + reuse detection), logout, credential validation |
| `src/auth/auth.controller.ts` | `/auth/register`, `/login`, `/refresh`, `/logout` endpoints |
| `src/auth/strategies/local.strategy.ts` | Passport **local** — validates email + password at login |
| `src/auth/strategies/jwt.strategy.ts` | Passport **jwt** — validates the Bearer access token, builds `req.user` |
| `src/auth/guards/jwt-auth.guard.ts` | Global guard; enforces JWT unless `@Public()` |
| `src/auth/guards/roles.guard.ts` | Global guard; enforces `@Roles(...)` |
| `src/auth/guards/local-auth.guard.ts` | Triggers the local strategy on the login route |
| `src/auth/decorators/public.decorator.ts` | `@Public()` — opt a route out of auth |
| `src/auth/decorators/roles.decorator.ts` | `@Roles(...)` — restrict a route to roles |
| `src/auth/decorators/current-user.decorator.ts` | `@CurrentUser()` — inject the authenticated user |
| `src/common/enums/user-role.enum.ts` | `UserRole` (re-exported from Prisma — single source of truth) |
| `prisma/schema.prisma` | `User`, `Admin`, `RefreshToken` models + `UserRole` enum |

Both guards are registered globally in `src/app.module.ts`:

```ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },  // authN on every route
  { provide: APP_GUARD, useClass: RolesGuard },     // authZ where @Roles is present
],
```

---

## 2. Request lifecycle

```
Incoming request
   ↓
JwtAuthGuard ──── @Public()?  ── yes ──► allow (skip auth)
   │ no
   ↓
Extract "Authorization: Bearer <token>" → JwtStrategy.validate()
   │  invalid/expired → 401 Unauthorized
   ↓ valid → req.user = { id, email, role }
RolesGuard ──── @Roles(...) present?  ── no ──► allow
   │ yes
   ↓
req.user.role ∈ required roles?  ── no ──► 403 Forbidden
   │ yes
   ↓
Controller handler runs (@CurrentUser() available)
```

Guards run **before** pipes/interceptors, so unauthorized requests never reach validation or your handler.

---

## 3. Token model

Two tokens, different jobs:

| | Access token | Refresh token |
|---|---|---|
| Type | Signed JWT (`JWT_ACCESS_SECRET`) | Opaque random string (64 bytes hex) |
| Lifetime | Short — `JWT_ACCESS_EXPIRES_IN` (default `15m`) | Long — `JWT_REFRESH_EXPIRES_DAYS` (default `7`) |
| Sent as | `Authorization: Bearer <token>` on every request | Only to `/auth/refresh` and `/auth/logout` |
| Stored server-side? | No (stateless) | Yes — **SHA-256 hash** in `RefreshToken` table |

### Rotation + reuse detection

Each refresh token belongs to a **family** (a UUID). On `/auth/refresh`:

1. Look up the presented token by its hash.
2. If it's already **revoked** → this is a **reuse** of a rotated token → revoke the *entire family*
   and return `401 Token reuse detected` (a stolen token can't be used to mint new ones).
3. If expired → `401`.
4. Otherwise: revoke the presented token, issue a new access + refresh pair **in the same family**.

Only the SHA-256 hash is stored, so a database leak never exposes usable refresh tokens.

---

## 4. Endpoint flows

```
Register:  POST /api/v1/auth/register  { email, password, firstName, lastName }
           → hashes password (bcrypt, cost 12), always creates a USER
             (role is NOT accepted here — privileged roles come from the seed / an admin endpoint)

Login:     POST /api/v1/auth/login     { email, password }
           → LocalStrategy validates credentials → { access_token, refresh_token }

Refresh:   POST /api/v1/auth/refresh   { refresh_token }
           → rotate → new { access_token, refresh_token }

Logout:    POST /api/v1/auth/logout    { refresh_token }   (requires access token)
           → revokes the refresh token (always returns 200, never reveals existence)
```

Client stores the pair, sends the access token on each request, and calls `/refresh` when it expires.

---

## 5. Protecting your own routes

Everything is protected by default. In any controller:

```ts
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  @Get()                                   // requires a valid access token (default)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findForUser(user.id);
  }

  @Roles(UserRole.ADMIN)                    // admins only (RolesGuard is global)
  @Get('all')
  findAll() {
    return this.service.findAll();
  }

  @Public()                                 // no auth at all
  @Get('public-summary')
  summary() {
    return this.service.publicSummary();
  }
}
```

`@Roles(A, B)` allows a user whose role is **A or B**.

---

## 6. Adding a new role

Roles live in the Prisma enum and are re-exported as `UserRole`. To add e.g. `MANAGER`:

**1. Add it to the schema** (`prisma/schema.prisma`):

```prisma
enum UserRole {
  USER
  ADMIN
  MANAGER   // ← new
}
```

**2. Migrate:**

```bash
npm run prisma:migrate -- --name add_manager_role
```

`UserRole` (from `src/common/enums/user-role.enum.ts`) now includes `MANAGER` automatically — it
re-exports the Prisma enum, so there's nothing else to update for the type.

**3. Use it** in guards:

```ts
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@Get('reports')
reports() { ... }
```

**4. (Optional) profile table.** If the role needs its own data (like `Admin` has an `Admin` row),
add a model:

```prisma
model Manager {
  id     String @id @default(uuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  // role-specific fields...
}
```

Then create the profile wherever that role is provisioned — the seed, or an **admin-only** endpoint
(public `register()` always creates a plain `USER`), inside a transaction:

```ts
await tx.user.update({ where: { id: userId }, data: { role: UserRole.MANAGER } });
await tx.manager.create({ data: { userId } });
```

If a role is just a permission level with no extra data, skip step 4 — the role on `User` is enough.

---

## 7. Reusing this system in any project

The auth module is self-contained. To drop it into another NestJS + Prisma app:

**Copy:** `src/auth/`, `src/common/enums/user-role.enum.ts`, the `PrismaModule`/`PrismaService`, and
the `User` + `RefreshToken` models. Register the two global guards in that app's `AppModule` and add
the JWT env vars (`JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_DAYS`).

**Adapt per project:**

- **Roles** — redefine the `UserRole` enum for that domain (`USER/ADMIN`, or `OWNER/MEMBER/VIEWER`, …).
- **Profile tables** — keep `Admin` only if you need it; add/remove per-role models.
- **Registration policy** — public registration **forces `role: USER`** (the `role` field is not
  accepted by `RegisterDto`); privileged roles are provisioned via the seed or an admin-only
  endpoint. If some app genuinely needs open role selection, add `role` back to `RegisterDto` and
  pass it through in `AuthService.register()`.
- **Token lifetimes** — tune via env.

What stays identical everywhere: the guard/strategy/decorator wiring, rotation + reuse detection,
bcrypt hashing, and the secure-by-default posture. That's the reusable core.

---

## 8. Extending further

- **Permissions (finer than roles).** Add a `permissions: string[]` claim to the JWT and a
  `PermissionsGuard` + `@RequirePermissions(...)` decorator, mirroring `RolesGuard`. Use when
  role-only checks get too coarse.
- **Ownership checks.** For "users can edit their own X", compare `@CurrentUser().id` to the
  resource owner in the service, or write a dedicated guard.
- **Third-party login (OAuth/Google/etc.).** Add another Passport strategy (e.g.
  `passport-google-oauth20`) as a new `*.strategy.ts` + guard — the rest of the pipeline is unchanged.
- **Email verification / password reset.** `User` already has `isEmailVerified`; add token tables
  and endpoints following the same service pattern.
- **Refresh-token cleanup.** Periodically delete expired/revoked rows (a scheduled `@Cron` job) to
  keep the `RefreshToken` table small.

---

## 9. Security checklist (already handled here)

- ✅ Passwords hashed with bcrypt (cost 12) — never stored or returned in plaintext.
- ✅ `passwordHash` excluded from responses via `UserResponseDto` + global serializer.
- ✅ Refresh tokens stored only as SHA-256 hashes; rotated on every use; family revoked on reuse.
- ✅ Short-lived access tokens; secret from env (min 32 chars, enforced by Joi).
- ✅ Auth headers / passwords redacted from logs (pino config).
- ✅ Secure-by-default routing — new routes are protected unless opted out with `@Public()`.