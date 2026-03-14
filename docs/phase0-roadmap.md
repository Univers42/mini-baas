## Phase 0 — Extended Implementation Plan

### Purpose and Scope

Phase 0 does not produce any externally observable functionality. There are no new endpoints, no business logic, and no integration tests that pass. Its sole output is a **structurally correct codebase** upon which all subsequent phases can be built without friction.

The success criterion is binary: `npx tsc --noEmit` returns zero errors and `nest build` compiles cleanly. Nothing more. Nothing less.

This discipline is intentional. In a project with multiple developers, a Phase 0 that tries to include "a bit of logic as well" becomes a Phase 0 that no one fully understands or reviews properly.

---

### Section 1 — Audit of the Current State

Before touching anything, we document exactly what exists and what decision is made about each piece.

#### `apps/backend/src/` — Inventory and Decisions

| File/Directory | Current State | Decision | Reason |
|---|---|---|---|
| `main.ts` | Basic [NestJS](https://nestjs.com/) skeleton | **Rewrite** | Missing Helmet, compression, cookie-parser, Swagger, global ValidationPipe |
| `app.module.ts` | Basic imports | **Empty and rebuild** | References [Prisma](https://www.prisma.io/) and modules that disappear |
| `app.controller.ts` | Hello World | **Delete** | No place in a BaaS without static business routes |
| `app.service.ts` | Empty | **Delete** | No function in the new architecture |
| `app.controller.spec.ts` | Hello world test | **Delete** | Test with no value |
| `health.controller.ts` | GET /health | **Keep** | Needed for Docker health checks and monitoring |
| `prisma.service.ts` | Wrapper for PrismaClient | **Delete** | Incompatible with dynamic model — this is the core reason for this phase |
| `testmain.ts` | Test file | **Delete** | No place in the project |
| `users/` | Static CRUD module | **Delete completely** | Contradicts the principle of Zero Business Logic Awareness |

#### `apps/backend/prisma/` — Inventory and Decisions

| File | Decision | Reason |
|---|---|---|
| `schema.prisma` | **Delete** | Prisma requires a static schema; mini-baas discovers schemas at runtime |
| `migrations/` | **Delete** | DDL migrations are handled dynamically by the Provisioner |
| `seed.ts` | **Archive in `examples/`** | May serve as a reference for Phase 11 (Vite Gourmand migration) |
| `prisma.config.ts` (root of `apps/backend/`) | **Delete** | |

#### `apps/backend/package.json` — Current Dependencies to Evaluate

What must be **removed**:

```json
"@prisma/client": "^7.4.1",
"prisma": "^7.4.1"
```

What must be **kept** (already useful):

```json
"@nestjs/common", "@nestjs/core", "@nestjs/config",
"@nestjs/event-emitter", "@nestjs/schedule", "@nestjs/swagger",
"@nestjs/throttler", "@nestjs/platform-express",
"compression", "cookie-parser", "helmet"
```

What must be **added** (full polyglot engine):

```json
// Query builders and database drivers
"knex",          // [Knex.js](http://knexjs.org/) - SQL query builder
"pg",            // [node-postgres](https://node-postgres.com/) for PostgreSQL
"mysql2",        // [MySQL2](https://github.com/sidorares/node-mysql2) for MySQL and MariaDB
"better-sqlite3", // [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for SQLite
"tedious",       // [Tedious](https://tediousjs.github.io/tedious/) for MSSQL
"mongodb",       // Native [MongoDB driver](https://github.com/mongodb/node-mongodb-native) (for tenants using Mongo)
"mongoose",      // [Mongoose ODM](https://mongoosejs.com/) for the Control Plane (NOT for tenants)

// Cache and distributed state
"ioredis",       // [ioredis](https://github.com/luin/ioredis) for Redis

// Security and cryptography
"bcrypt",        // [bcrypt](https://github.com/kelektiv/node.bcrypt.js) for hashing

// Authorization
"@casl/ability", // [CASL](https://casl.js.org/) ability system

// Runtime validation
"ajv",           // [AJV](https://ajv.js.org/) JSON schema validator
"ajv-formats",   // extension for formats like email, date-time, uuid

// JWT and authentication (Phase 2+, but installed now to avoid interruptions)
"@nestjs/jwt",   // [NestJS JWT](https://docs.nestjs.com/security/authentication#jwt-token)
"@nestjs/passport", // [NestJS Passport](https://docs.nestjs.com/security/authentication)
"passport",      // [Passport.js](https://www.passportjs.org/)
"passport-jwt",  // [Passport JWT strategy](https://www.passportjs.org/packages/passport-jwt/)

// Types (devDependencies)
"@types/bcrypt",
"@types/passport-jwt",
"@types/better-sqlite3",
"@types/pg"
```

**Note on `mongoose` vs `mongodb`:** Both are installed for different reasons. `mongoose` is used **only** in the Control Plane (system [MongoDB](https://www.mongodb.com/), stable schemas). `mongodb` (native driver) is used for **tenants** that choose MongoDB as their engine — because in that context we need to work with completely dynamic collections without predefined schemas.

---

### Section 2 — The New Directory Structure

This is the most important decision of the entire phase. Once established and agreed upon by the team, **it is not to be touched**. Changing the structure in Phase 3 would be a painful refactor.

```
apps/backend/src/
│
├── main.ts                          # Global entry point
├── app.module.ts                    # Root module (only imports, no logic)
├── health.controller.ts             # GET /health (preserved)
│
├── common/                          # Shared contracts — ZERO external dependencies
│   ├── interfaces/
│   │   └── database-adapter.interface.ts   # IDatabaseAdapter — the central contract
│   ├── types/
│   │   ├── schema.types.ts          # UniversalSchemaMap, EntityDefinition, FieldDefinition
│   │   ├── query.types.ts           # QueryIR, WhereClause, QueryResult
│   │   └── tenant.types.ts          # MasterDocument, TenantConfig, TenantStatus
│   ├── schemas/
│   │   └── system-entities.ts       # The 16 _baas_* entities (filled in during module phases)
│   ├── crypto/
│   │   ├── encryption.service.ts    # AES-256-GCM (implemented in module phases)
│   │   └── crypto.module.ts
│   ├── interceptors/
│   │   └── tenant.interceptor.ts    # Loads Master Document per request (Phase 3)
│   ├── decorators/
│   │   ├── adapter.decorator.ts     # @InjectAdapter()
│   │   └── tenant.decorator.ts      # @Tenant()
│   ├── exceptions/
│   │   └── all-exceptions.filter.ts # Global error filter
│   └── index.ts                     # Barrel export
│
├── infrastructure/                  # Connections to external services
│   ├── system-db/
│   │   └── system-db.module.ts      # Mongoose connection → MongoDB Control Plane
│   └── cache/
│       └── cache.module.ts          # ioredis connection → Redis
│
└── modules/                         # All functional code
    │
    ├── control-plane/               # System management (Phase 1)
    │   ├── control-plane.module.ts
    │   ├── tenant/
    │   │   ├── tenant.service.ts
    │   │   ├── tenant.controller.ts
    │   │   ├── tenant.schema.ts     # Mongoose schema for the Master Document
    │   │   └── dto/
    │   │       └── tenant.dto.ts
    │   ├── metadata/
    │   │   ├── metadata.service.ts
    │   │   ├── metadata.controller.ts
    │   │   ├── schema-version.schema.ts
    │   │   └── dto/
    │   │       └── metadata.dto.ts
    │   ├── iam/
    │   │   ├── iam.module.ts
    │   │   └── policy.engine.ts     # CASL ABAC engine (Phase 5)
    │   └── provisioner/
    │       ├── provisioner.service.ts  # Provisions the 16 entities (module phases)
    │       └── provisioner.module.ts
    │
    ├── engines/                     # Database abstraction layer (Phase 2)
    │   ├── engines.module.ts
    │   ├── core/
    │   │   └── database-provider.factory.ts
    │   ├── sql/
    │   │   └── sql.adapter.ts       # Knex.js — 5 SQL engines
    │   └── nosql/
    │       └── mongo.adapter.ts     # Native MongoDB driver
    │
    ├── data-plane/                  # Dynamic API (Phase 3+)
    │   ├── data-plane.module.ts
    │   ├── dynamic-api/
    │   │   ├── dynamic.controller.ts
    │   │   ├── dynamic.service.ts
    │   │   └── dynamic-api.module.ts
    │   ├── validation/
    │   │   ├── validation.engine.ts
    │   │   └── validation.module.ts
    │   └── transformation/
    │       └── transformation.service.ts
    │
    ├── auth/                        # Per-tenant authentication (module phases)
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── decorators/
    │   │   └── current-user.decorator.ts
    │   ├── dto/
    │   │   └── auth.dto.ts
    │   ├── guards/
    │   │   └── jwt-auth.guard.ts
    │   └── services/
    │       ├── auth.service.ts
    │       ├── password.service.ts
    │       ├── token.service.ts
    │       └── identity.service.ts
    │
    ├── session/
    │   ├── session.module.ts
    │   └── session.service.ts
    │
    ├── rbac/
    │   ├── rbac.module.ts
    │   ├── decorators/
    │   │   └── roles.decorator.ts
    │   ├── guards/
    │   │   ├── roles.guard.ts
    │   │   └── permissions.guard.ts
    │   └── services/
    │       └── role.service.ts
    │
    ├── audit/
    │   ├── audit.module.ts
    │   └── audit.service.ts
    │
    ├── gdpr/
    │   ├── gdpr.module.ts
    │   ├── gdpr.service.ts
    │   └── gdpr.controller.ts
    │
    ├── mail/
    │   ├── mail.module.ts
    │   └── mail.service.ts
    │
    ├── notification/
    │   ├── notification.module.ts
    │   ├── notification.service.ts
    │   └── notification.controller.ts
    │
    ├── newsletter/
    │   ├── newsletter.module.ts
    │   ├── newsletter.service.ts
    │   └── newsletter.controller.ts
    │
    ├── files/
    │   ├── file.module.ts
    │   └── file.service.ts
    │
    ├── analytics/
    │   ├── analytics.module.ts
    │   ├── analytics.service.ts
    │   └── analytics.controller.ts
    │
    ├── webhook/
    │   ├── webhook.module.ts
    │   ├── webhook.service.ts
    │   └── webhook.controller.ts
    │
    ├── api-keys/
    │   ├── api-key.module.ts
    │   ├── api-key.service.ts
    │   ├── api-key.guard.ts
    │   └── api-key.controller.ts
    │
    ├── security/
    │   ├── security.module.ts
    │   ├── guards/
    │   │   ├── ip-filter.guard.ts
    │   │   ├── rate-limiter.guard.ts
    │   │   └── sanitization.guard.ts
    │   └── middleware/
    │       └── security-headers.middleware.ts
    │
    └── runtime/
        ├── background-jobs/         # [BullMQ](https://docs.bullmq.io/) (Phase 9)
        └── hooks/                   # Hook Sandbox (Phase 8)
```

#### Dependency Rule — The Most Important Rule of the Project

```
common/     → imports NOTHING from this project (only node_modules)
infrastructure/ → may import common/
modules/    → may import common/ and infrastructure/
             CANNOT directly import between modules (only via interfaces)
```

This rule prevents dependency cycles that destroy medium-sized NestJS projects. If the `auth` module needs something from the `session` module, it does so through an interface in `common/`, never with a direct import.

---

### Section 3 — Phase 0 Files

In Phase 0, most files are created **empty or with minimal stubs**. No logic is implemented — only the structure is established so that [TypeScript](https://www.typescriptlang.org/) compiles without errors.

#### Stub Pattern for Future Modules

Each module that will not be implemented until later phases follows this exact pattern:

```typescript
// src/modules/audit/audit.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class AuditModule {}
```

```typescript
// src/modules/audit/audit.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditService {
  // Implemented in Module Build Phase 4
}
```

This pattern is deliberate. Having the file exist but be empty allows `app.module.ts` to import all modules from day one — any developer knows where they will work, and `tsc` does not complain about imports to non-existent files.

#### The Only Files with Real Content in Phase 0

**`main.ts`** — complete global configuration, no reason to leave it incomplete:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/exceptions/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);

  // HTTP security
  app.use(helmet());                // [Helmet](https://helmetjs.github.io/)
  app.use(compression());           // [compression](https://github.com/expressjs/compression)
  app.use(cookieParser());          // [cookie-parser](https://github.com/expressjs/cookie-parser)

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // CORS (configured per tenant in Phase 7, here it's global)
  app.enableCors({
    origin: config.get('CORS_ORIGIN', '*'),
    credentials: true,
  });

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('mini-baas API')
    .setDescription('Metadata-driven polyglot Backend-as-a-Service')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
    .build();

  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(port);
  Logger.log(`mini-baas running on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger: http://localhost:${port}/docs`, 'Bootstrap');
}
bootstrap();
```

**`common/exceptions/all-exceptions.filter.ts`** — needed for `main.ts` to compile:

```typescript
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
```

**`tsconfig.json`** — path aliases for clean imports:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "paths": {
      "@common/*": ["src/common/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@modules/*": ["src/modules/*"]
    }
  }
}
```

**`.env.example`** — contract for environment variables for the team:

```bash
# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# Control Plane Database (MongoDB — system, not tenants)
MONGODB_URI=mongodb://localhost:27117
MONGODB_DB_NAME=mini_baas_control

# Cache
REDIS_HOST=localhost
REDIS_PORT=6379

# Cryptography — NEVER commit the actual value
# Generate with: openssl rand -hex 32
MASTER_ENCRYPTION_KEY=replace_with_32_byte_hex_string

# Swagger
SWAGGER_ENABLED=true
```

---

### Section 4 — Execution Sequence

This is the exact sequence, ordered so that any developer on the team can execute it from start to finish without ambiguous decisions.

**Step 1 — Working branch**
```bash
git checkout -b feat/phase-0-ddd-structure
```

**Step 2 — Clean up incompatible dependencies**
```bash
cd apps/backend
pnpm remove @prisma/client prisma
```

**Step 3 — Install engine dependencies**
```bash
pnpm add knex pg mysql2 better-sqlite3 tedious mongodb mongoose ioredis
pnpm add bcrypt @casl/ability ajv ajv-formats
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt
pnpm add -D @types/bcrypt @types/passport-jwt @types/better-sqlite3 @types/pg
```

**Step 4 — Delete incompatible files**
```bash
# Save seed as reference before deleting
cp prisma/seed.ts ../../examples/Back/prisma/seed.reference.ts

rm src/app.controller.ts
rm src/app.controller.spec.ts
rm src/app.service.ts
rm src/prisma.service.ts
rm src/testmain.ts
rm prisma.config.ts
rm -rf src/users/
rm -rf prisma/
```

**Step 5 — Create directory structure**
```bash
# common/
mkdir -p src/common/{interfaces,types,schemas,crypto,interceptors,decorators,exceptions}

# infrastructure/
mkdir -p src/infrastructure/{system-db,cache}

# control-plane/
mkdir -p src/modules/control-plane/{tenant/dto,metadata/dto,iam,provisioner}

# engines/
mkdir -p src/modules/engines/{core,sql,nosql}

# data-plane/
mkdir -p src/modules/data-plane/{dynamic-api,validation,transformation}

# functional modules
mkdir -p src/modules/auth/{decorators,dto,guards,services}
mkdir -p src/modules/session
mkdir -p src/modules/rbac/{decorators,guards,services}
mkdir -p src/modules/{audit,gdpr,mail,notification,newsletter}
mkdir -p src/modules/{files,analytics,webhook,api-keys}
mkdir -p src/modules/security/{guards,middleware}
mkdir -p src/modules/runtime/{background-jobs,hooks}

# studio (future admin UI)
mkdir -p src/studio/{bootstrap,collections,config,environments,schemas,seeds,types}
```

**Step 6 — Create stubs for all modules**

For each functional module (`audit`, `gdpr`, `mail`, `notification`, `newsletter`, `files`, `analytics`, `webhook`, `api-keys`, `security`, `session`, `rbac`, `auth`, `data-plane`, `engines`, `control-plane`): create the empty `.module.ts` and minimal stubs for `.service.ts` / `.controller.ts`.

**Step 7 — Create type files in `common/`**

Create empty type files with only the necessary exports to keep TypeScript happy:

```typescript
// src/common/types/schema.types.ts
export type UniversalFieldType = string; // expanded in Phase 2
export interface FieldDefinition { type: UniversalFieldType; }
export interface EntityDefinition { fields: Record<string, FieldDefinition>; }
export type UniversalSchemaMap = Record<string, EntityDefinition>;
export interface IndexDefinition { fields: string[]; unique?: boolean; }
```

```typescript
// src/common/types/query.types.ts
export interface QueryOptions {
  where?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
  select?: string[];
}
export interface QueryResult {
  data: Record<string, unknown>[];
  total: number;
}
export interface QueryIR extends QueryOptions {
  entity: string;
  include?: string[];
}
```

```typescript
// src/common/types/tenant.types.ts
export type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'archived';
export interface MasterDocument {
  tenantId: string;
  name: string;
  status: TenantStatus;
  database: Record<string, unknown>;
  schema: Record<string, unknown>;
  config: Record<string, unknown>;
  version: number;
}
```

**Step 8 — Create the `IDatabaseAdapter` interface** with all methods declared (no implementation).

**Step 9 — Rewrite `main.ts`** with the full code from the section above.

**Step 10 — Rewrite `app.module.ts`** minimal, only including ConfigModule and HealthController. All future-phase modules will be added in their respective phases — empty stubs are **not** imported into `AppModule` yet.

**Step 11 — Update `tsconfig.json`** with the path aliases.

**Step 12 — Create `.env.example`** with all documented variables.

**Step 13 — Verification**
```bash
npx tsc --noEmit    # MUST give 0 errors
nest build          # MUST compile without errors
curl localhost:3000/health  # MUST return 200
```

**Step 14 — Commit and PR**
```bash
git add .
git commit -m "feat: phase-0 — DDD structure, Prisma removal, polyglot dependencies"
git push origin feat/phase-0-ddd-structure
```

---

### Section 5 — PR Review Criteria

When another developer reviews the Phase 0 PR, they must verify exactly this:

**Structure**
- [ ] Directories follow exactly the map defined in this document
- [ ] No `*.prisma` file, `prisma.service.ts`, or `prisma/` directory exists
- [ ] The `users/` module and any business domain module are absent
- [ ] `src/common/interfaces/database-adapter.interface.ts` exists with the full interface declared

**Dependencies**
- [ ] `package.json` does not contain `@prisma/client` or `prisma`
- [ ] `package.json` contains `knex`, `pg`, `mongodb`, `mongoose`, `ioredis`, `bcrypt`, `@casl/ability`, `ajv`
- [ ] `pnpm-lock.yaml` is updated (no references to Prisma)

**TypeScript**
- [ ] `npx tsc --noEmit` gives exactly 0 errors
- [ ] `tsconfig.json` has the path aliases `@common/*`, `@infrastructure/*`, `@modules/*`

**Runtime**
- [ ] `nest build` compiles without errors
- [ ] `GET /health` returns 200
- [ ] `GET /docs` returns the Swagger UI

**Documentation**
- [ ] `.env.example` exists and is up to date
- [ ] The Prisma `seed.ts` has been preserved in `examples/Back/` as a reference

---

### Section 6 — Decisions Pending (for Meeting with Project Owner)

These are decisions that **do not block Phase 0** but must be resolved before Phase 1:

| Decision | Options | Impact |
|---|---|---|
| Should Vite Gourmand become a tenant of mini-baas? | Yes / No / Later | Defines whether Phase 11 is a priority or future work |
| Unified docker-compose or separate per app? | Unified / Separate | Affects network configuration between services |
| `MASTER_ENCRYPTION_KEY` in team Bitwarden or CI/CD secrets? | Bitwarden / GitHub Secrets / Vault | Affects developer onboarding flow |
| Does the Control Plane have a web admin panel (Studio)? | Yes (high priority) / No (API only) | Determines whether `src/studio/` is developed in parallel |
| Support MSSQL from day one? | Yes / No | `tedious` is already installed, but adds complexity to SqlAdapter |

---

### Executive Summary of Phase 0

Phase 0 is a phase of **preparation and architectural investment**. The team invests time now to establish a structure that will not need to be reconsidered in any later phase. The output is not visible to the end user, but it is the necessary condition for everything that follows to be predictable, reviewable, and extensible.

**Estimated duration:** 2–4 hours for a developer with the context of this document.

**Risk if omitted or done half‑heartedly:** Phases 1–7 produce code that does not follow uniform conventions, circular imports begin to appear in Phases 3–4, and onboarding new developers requires deciphering the structure instead of reading it in this document.