# Configuration workflow

Config in this template is **validated, namespaced, and type-safe**. Never read `process.env`
directly in feature code — go through `ConfigService` / a config namespace so values are validated
at boot and typed at the call site.

The moving parts:

| File | Role |
|------|------|
| `src/config/validation.schema.ts` | Joi schema — validates all env vars at startup (fail-fast) |
| `src/config/*.config.ts` | `registerAs` namespaces (`app`, `database`, `jwt`, …) |
| `src/app.module.ts` | `ConfigModule.forRoot({ load: [...] })` registers the namespaces |
| `.env.example` / `.env.development` / … | Values per environment |

## Adding a new variable — end to end

Example: an S3 integration needing `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`.

### 1. Validate it

Add the keys to `src/config/validation.schema.ts`. The app won't boot if a required key is missing/invalid:

```ts
export const validationSchema = Joi.object({
  // ...existing keys...
  S3_ACCESS_KEY: Joi.string().required(),
  S3_SECRET_KEY: Joi.string().required(),
  S3_BUCKET: Joi.string().required(),
  S3_REGION: Joi.string().default('us-east-1'),
});
```

### 2. Give it a namespace

Create `src/config/s3.config.ts` (mirrors the existing `app`/`database`/`jwt` configs):

```ts
import { registerAs } from '@nestjs/config';

export interface S3Config {
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export const s3Config = registerAs('s3', (): S3Config => ({
  accessKey: process.env.S3_ACCESS_KEY as string,
  secretKey: process.env.S3_SECRET_KEY as string,
  bucket: process.env.S3_BUCKET as string,
  region: process.env.S3_REGION ?? 'us-east-1',
}));
```

### 3. Load the namespace

Register it in `src/app.module.ts`:

```ts
import { s3Config } from './config/s3.config';

ConfigModule.forRoot({
  // ...
  load: [appConfig, databaseConfig, jwtConfig, s3Config], // ← add it here
});
```

### 4. Document & set the value

Add the keys to every env file: `.env.example` (placeholder), `.env.development` (working/local
value), and `.env.staging` / `.env.production` (or inject via the host at deploy time). Add a row to
the env-vars table in the README so the variable is discoverable.

### 5. Consume it — type-safe

```ts
// a) via ConfigService (anywhere)
constructor(private readonly config: ConfigService) {}
const bucket = this.config.get<string>('s3.bucket');

// b) via the namespace token (full type inference — preferred inside a dedicated module)
import { ConfigType } from '@nestjs/config';
import { s3Config } from '../config/s3.config';

constructor(
  @Inject(s3Config.KEY) private readonly s3: ConfigType<typeof s3Config>,
) {}
// this.s3.bucket / this.s3.region — fully typed
```

## Rules of thumb

- **Required at boot** → mark `.required()` in Joi so a missing key stops the app early.
- **Optional** → give it a `.default(...)` in Joi and a fallback in the `registerAs` factory.
- **Secrets** → never commit a real value. Placeholders in `.env.example`; real values live in
  git-ignored env files (`.env.development.local`, `.env.staging`, `.env.production`) or the host
  environment, which overrides file values.
- **One namespace per concern** (`s3`, `redis`, `mail`, …) keeps access typed and discoverable.
