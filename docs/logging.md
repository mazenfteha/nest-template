# Logging

The app uses Nest's built-in logger. There are no logging packages and there is one setup point.

## What a log line looks like

```
[Nest] 26932  - 11/15/2026, 2:52:23 PM     LOG [HTTP] GET /api/v1/users/me 200 68ms
[Nest] 26932  - 11/15/2026, 2:52:23 PM    WARN [HTTP] POST /api/v1/auth/login 401 144ms
[Nest] 26932  - 11/15/2026, 2:52:40 PM   ERROR [AllExceptionsFilter] GET /api/v1/… failed (500, request 0b7a…): <message>
    <stack>
```

## How it is wired

| Piece | File | What it does |
| --- | --- | --- |
| `AppLogger` | `src/common/logging/app-logger.ts` | `ConsoleLogger` whose levels come from `LOG_LEVEL`. Exports `logLevels()` for code that needs to check the current level. |
| Setup | `src/main.ts` | `NestFactory.create(AppModule, { logger: new AppLogger() })`. Every `new Logger('X')` writes through it. |
| Request id | `src/common/context/request-id.middleware.ts` | Reuses a valid incoming `x-request-id`, otherwise makes a UUID. Sets `req.id` and the `x-request-id` response header. |
| Request log | `src/common/logging/request-logger.middleware.ts` | One `[HTTP] METHOD URL STATUS TIMEms` line per request. Skips `/health/`. |
| Errors | `src/common/filters/all-exceptions.filter.ts` | 5xx: `ERROR` line with message, stack and request id. 4xx: `DEBUG` line only. The error JSON includes `requestId`, so a client report can be matched to the log. |
| Prisma | `src/prisma/prisma.service.ts` | Prisma warnings go to `[Prisma]`. SQL queries with durations are logged only at `LOG_LEVEL=verbose`. |
| Helpers | `src/common/logging/log-format.ts` | `errorMessage(err)` / `errorStack(err)` for anything thrown. |

The middleware order in `main.ts` matters: `requestIdMiddleware` first, then `requestLoggerMiddleware`, then helmet and the rest.

## Levels

`LOG_LEVEL` is optional: `verbose | debug | log | warn | error`. Each level also prints the more serious ones. If unset, it is `debug` in development and `log` everywhere else.

| Level | Use it for |
| --- | --- |
| `error` | Something failed and needs attention: 5xx, failed background work, a dependency that's down. Always include the stack. |
| `warn` | Unexpected but handled: 4xx request lines, retries, fallbacks, deprecated usage. |
| `log` | Normal events worth seeing in production: startup, request lines, important state changes. |
| `debug` | Detail useful while developing: 4xx reasons, branch decisions. |
| `verbose` | Very noisy detail, such as every SQL query. |

## Rules

- Create a logger per class: `private readonly logger = new Logger(MyService.name);`. Never use `console.*`.
- One readable sentence per line, with the useful ids inside the message: `` `Order ${orderId} paid by user ${userId}` ``.
- Never pass objects. Nest prints them badly. Put the values you need in the string.
- Log errors like this:

  ```ts
  this.logger.error(`Upload of ${key} failed: ${errorMessage(err)}`, errorStack(err));
  ```

- Never log tokens, passwords, secrets, API keys, `Authorization` headers, or request/response bodies.
