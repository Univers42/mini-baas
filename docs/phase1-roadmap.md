## Phase 1 — Extended Implementation Plan: Control Plane

### Purpose and Scope

If [Phase 0](./phase0-roadmap.md) was about laying the foundations, Phase 1 is about building the **central nervous system**. The Control Plane is the only part of mini‑baas that has a global view of the system — it is the only place where the concept of a "tenant" exists. Everything else (adapters, dynamic API, auth modules) are consumers that ask the Control Plane: *“Who is this tenant and how are they configured?”*

The success criteria for this phase are equally binary but richer:

- `npx tsc --noEmit` → zero errors
- `nest build` → clean compilation
- `POST /control-plane/tenants` → creates a tenant with status `provisioning`
- `GET /control-plane/tenants/:id` → returns the full Master Document
- `POST /control-plane/tenants/:id/suspend` → transitions state correctly

---

### Section 1 — What We Build and Why Each Piece Exists

#### 1.1 `SystemDbModule` — The Control Plane DB Connection

This is the **only [MongoDB](https://www.mongodb.com/ "MongoDB is a source‑available, document‑oriented NoSQL database") connection managed by [Mongoose](https://mongoosejs.com/ "Mongoose is an ODM (Object Data Modeling) library for MongoDB and Node.js")** in the entire project. It’s important to understand the distinction:

- `SystemDbModule` → MongoDB → managed by Mongoose → for the Control Plane
- Tenants that choose MongoDB as their engine → managed by the native driver (`mongodb`) → for business data

Mongoose is used here because the Control Plane has relatively stable and well‑defined schemas. The `TenantMetadata` always has `tenantId`, `status`, `database`, `config`, `version` — it’s a document with a known structure. Mongoose provides validation, typing, and an ergonomic API over that stable structure.

The module is `@Global()` because the `TenantService` and `MetadataService` need to access it from anywhere in the system without re‑importing it into each module.

#### 1.2 `CacheModule` — [Redis](https://redis.io/ "Redis is an in‑memory data structure store, used as a database, cache, and message broker") as the L1 Layer

Redis has three responsibilities in Phase 1 (and more in later phases):

**Master Document Cache:** Every Data Plane request needs the tenant’s Master Document. Without Redis, each request would make a MongoDB query. With Redis, the document is loaded once and served from memory for all subsequent requests until the TTL expires or it is explicitly invalidated.

The cache key follows the mandatory namespacing pattern from the strategic document:

```
tenant:{tenantId}:master-document
```

**Rate Limiting State:** The rate limiter in Phase 7 needs a per‑tenant counter that persists between requests. Redis is the only correct tool for this.

**Active Invalidation:** When the `MetadataService` modifies a tenant’s schema, it immediately invalidates the cache entry. This ensures that the next request gets the updated document.

The module is also `@Global()` — Redis is a cross‑cutting infrastructure needed by almost all modules.

#### 1.3 `TenantMetadata` Mongoose Schema — The Master Document in the DB

The Mongoose schema defines the shape of the document living in the MongoDB `tenants` collection. There is an important design decision here: we use `type: Object` / `type: mongoose.Schema.Types.Mixed` for the complex nested fields (`schema`, `hooks`, `permissions`, `config`).

The reason is as explained in the strategic document: these fields are **heterogeneous by design**. A restaurant tenant’s schema has `orders`, `menus`, `dishes`. An e‑commerce tenant’s schema has `products`, `categories`, `carts`. Trying to model that with strict Mongoose types would contradict the principle of Zero Business Logic Awareness.

What *is* strictly validated with Mongoose are the envelope fields:

- `tenantId` — required, unique, slug format
- `status` — strict enum
- `database.engine` — strict enum of supported engines
- `version` — integer, minimum 1

#### 1.4 `TenantService` — The Complete Lifecycle

The `TenantService` manages a tenant’s state transitions. The state graph is:

```
[new] → provisioning → active ↔ suspended → archived
                                              ↑
                                         (terminal)
```

Transition rules are:

- `provisioning` → `active`: only when the Provisioner has completed its work (Module Phases)
- `active` → `suspended`: admin can suspend at any time
- `suspended` → `active`: admin can reactivate
- `active/suspended` → `archived`: terminal, not reversible
- `archived` → anything else: **forbidden**

In Phase 1, `activate()` only changes the status to `active` and generates encrypted secrets. The actual Provisioner (which creates the 16 system entities) comes in the Module Phase. This separation is deliberate — we don’t want Phase 1 to have dependencies on the Engine Layer that does not yet exist.

#### 1.5 `MetadataService` — Schema Versioning

Every time a tenant’s schema is modified, this flow runs:

```
1. Read current schema (version N)
2. Save snapshot in SchemaVersion (separate collection)
3. Apply changes to the Master Document
4. Increment version → N+1
5. Invalidate Redis cache
```

This allows rollback: if a schema migration breaks something, the admin can do `POST /control-plane/tenants/:id/schema/rollback/12` and the system restores the version 12 snapshot.

`SchemaVersion` is not a relational migrations table like [Prisma](https://www.prisma.io/ "Prisma is an ORM for Node.js and TypeScript")/[Flyway](https://flywaydb.org/ "Flyway is a database migration tool"). It is a full snapshot of the `UniversalSchemaMap` at a given point in time. Simpler, more robust for this use case.

#### 1.6 [Docker Compose](https://docs.docker.com/compose/ "Docker Compose is a tool for defining and running multi‑container Docker applications") — The Development Infrastructure

The strategic document defines exactly the four required services:

```
mongodb   → MongoDB 7     → Control Plane DB          :27017
db        → PostgreSQL 16 → Default SQL Tenant        :5432
redis     → Redis 7       → Cache + rate limit state  :6379
mailpit   → Mailpit       → Email catcher dev         :1025/:8025
```

[PostgreSQL](https://www.postgresql.org/ "PostgreSQL is a powerful, open source object‑relational database system") at this point serves as the test engine for the first real tenant we will create when validating Phase 2.

---

### Section 2 — Files to Create

#### Structure of New Files in Phase 1

```
apps/backend/src/
│
├── infrastructure/
│   ├── system-db/
│   │   └── system-db.module.ts          ← NEW (Mongoose connection)
│   └── cache/
│       └── cache.module.ts              ← NEW ([ioredis](https://github.com/luin/ioredis "ioredis is a robust, performance‑focused Redis client for Node.js") connection)
│
└── modules/
    └── control-plane/
        ├── control-plane.module.ts      ← NEW
        ├── tenant/
        │   ├── tenant.schema.ts         ← NEW (Mongoose schema)
        │   ├── tenant.service.ts        ← NEW (lifecycle)
        │   ├── tenant.controller.ts     ← NEW (REST endpoints)
        │   └── dto/
        │       └── tenant.dto.ts        ← NEW (validated DTOs)
        ├── metadata/
        │   ├── metadata.service.ts      ← NEW (schema CRUD + versioning)
        │   ├── metadata.controller.ts   ← NEW
        │   ├── schema-version.schema.ts ← NEW (version snapshots)
        │   └── dto/
        │       └── metadata.dto.ts      ← NEW
        ├── iam/
        │   ├── iam.module.ts            ← stub (to be implemented in Phase 5)
        │   └── policy.engine.ts         ← stub
        └── provisioner/
            ├── provisioner.service.ts   ← stub (to be implemented in Module Phase)
            └── provisioner.module.ts    ← stub
```

And `app.module.ts` is updated to import the new modules.

---

### Section 3 — File‑by‑File Implementation

#### `src/infrastructure/system-db/system-db.module.ts`

```typescript
import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017'),
        dbName: config.get<string>('MONGODB_DB_NAME', 'mini_baas_control'),
        // Robust connection options for production
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      }),
    }),
  ],
  exports: [MongooseModule],
})
export class SystemDbModule {}
```

**Why `@Global()`:** The `TenantService` and `MetadataService` need to inject their Mongoose Models. If the module were not global, every module using Mongoose models would have to explicitly import `SystemDbModule`. With `@Global()`, importing it once in `AppModule` suffices.

---

#### `src/infrastructure/cache/cache.module.ts`

```typescript
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const client = new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          // Automatic retries with exponential backoff
          retryStrategy: (times: number) => Math.min(times * 50, 2000),
          lazyConnect: false,
        });

        client.on('connect', () =>
          console.log('[Redis] Connected to cache'),
        );
        client.on('error', (err) =>
          console.error('[Redis] Connection error:', err),
        );

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class CacheModule {}
```

**`Symbol` as the injection token:** We use `Symbol('REDIS_CLIENT')` instead of a string `'REDIS_CLIENT'` to avoid name collisions in the [NestJS](https://nestjs.com/ "NestJS is a progressive Node.js framework for building efficient and scalable server‑side applications") IoC container. It’s a standard practice for infrastructure providers.

---

#### `src/modules/control-plane/tenant/tenant.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TenantMetadataDocument = TenantMetadata & Document;

export type TenantStatus =
  | 'provisioning'
  | 'active'
  | 'suspended'
  | 'archived';

export type DatabaseEngine =
  | 'postgresql'
  | 'mysql'
  | 'mariadb'
  | 'sqlite'
  | 'mssql'
  | 'mongodb';

@Schema({
  timestamps: true,        // automatically adds createdAt and updatedAt
  collection: 'tenants',
  // Validation at MongoDB level — last line of defense
  // (actual validation happens in DTOs)
})
export class TenantMetadata {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  tenantId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: ['provisioning', 'active', 'suspended', 'archived'],
    default: 'provisioning',
  })
  status: TenantStatus;

  // Tenant database configuration
  // The URI is stored encrypted — the EncryptionService will handle it
  @Prop({
    type: {
      engine: {
        type: String,
        enum: ['postgresql', 'mysql', 'mariadb', 'sqlite', 'mssql', 'mongodb'],
        required: true,
      },
      uri: { type: String, required: true },   // encrypted at rest
      poolMin: { type: Number, default: 2 },
      poolMax: { type: Number, default: 10 },
    },
    required: true,
  })
  database: {
    engine: DatabaseEngine;
    uri: string;
    poolMin: number;
    poolMax: number;
  };

  // UniversalSchemaMap — free‑form by design
  // Contains the EntityDefinition for each entity of the tenant
  @Prop({ type: Object, default: {} })
  schema: Record<string, unknown>;

  // Per‑entity hooks (beforeCreate, afterCreate, etc.)
  @Prop({ type: Object, default: {} })
  hooks: Record<string, unknown>;

  // Per‑entity ABAC permission rules
  @Prop({ type: Object, default: {} })
  permissions: Record<string, unknown>;

  // Security, mail, files, rate limiting, CORS configuration
  // Secrets (pepper, jwtSecret, smtp.password) are encrypted with AES-256-GCM
  @Prop({
    type: Object,
    default: () => ({
      security: {
        pepper: null,         // generated in activate(), encrypted
        jwtSecret: null,      // generated in activate(), encrypted
        sessionTtl: 604800,   // 7 days in seconds
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireDigit: true,
          requireSpecial: true,
        },
        maxLoginAttempts: 5,
        lockoutDurationMs: 900000, // 15 minutes
      },
      rateLimit: {
        windowMs: 60000,  // 1 minute
        max: 120,         // 120 requests/min by default
      },
      cors: {
        origins: ['*'],
      },
    }),
  })
  config: Record<string, unknown>;

  // Schema version — incremented with every change via MetadataService
  @Prop({ type: Number, default: 1, min: 1 })
  version: number;

  // Automatic Mongoose timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export const TenantMetadataSchema =
  SchemaFactory.createForClass(TenantMetadata);

// Indexes for the most frequent queries
TenantMetadataSchema.index({ tenantId: 1 }, { unique: true });
TenantMetadataSchema.index({ status: 1 });
TenantMetadataSchema.index({ 'database.engine': 1 });
```

---

#### `src/modules/control-plane/tenant/dto/tenant.dto.ts`

```typescript
import {
  IsString, IsEnum, IsNotEmpty, IsOptional,
  IsNumber, IsObject, Min, Max, Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DatabaseEngine } from '../tenant.schema';

export class CreateTenantDto {
  @ApiProperty({ example: 'vite-gourmand', description: 'Unique slug identifier' })
  @IsString()
  @IsNotEmpty()
  // Only lowercase letters, numbers and hyphens — no spaces or special characters
  @Matches(/^[a-z0-9-]+$/, {
    message: 'tenantId must contain only lowercase letters, numbers and hyphens',
  })
  tenantId: string;

  @ApiProperty({ example: 'Vite Gourmand Restaurant' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'postgresql', enum: ['postgresql', 'mysql', 'mariadb', 'sqlite', 'mssql', 'mongodb'] })
  @IsEnum(['postgresql', 'mysql', 'mariadb', 'sqlite', 'mssql', 'mongodb'])
  engine: DatabaseEngine;

  @ApiProperty({ example: 'postgresql://user:pass@localhost:5432/mydb' })
  @IsString()
  @IsNotEmpty()
  databaseUri: string;

  @ApiPropertyOptional({ example: 2, default: 2 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  poolMin?: number;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  poolMax?: number;
}

export class UpdateTenantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

// For state transition endpoints we don't need a DTO
// because they have no body — the action is implicit in the URL
```

---

#### `src/modules/control-plane/tenant/tenant.service.ts`

```typescript
import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, Logger, Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { TenantMetadata, TenantMetadataDocument, TenantStatus } from './tenant.schema';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';
import { REDIS_CLIENT } from '../../../infrastructure/cache/cache.module';

// Master Document cache TTL: 5 minutes
// Long enough to reduce Mongo queries,
// short enough for config changes to propagate quickly
const CACHE_TTL_SECONDS = 300;

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectModel(TenantMetadata.name)
    private readonly tenantModel: Model<TenantMetadataDocument>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async create(dto: CreateTenantDto): Promise<TenantMetadataDocument> {
    // Check that the tenantId does not already exist
    const existing = await this.tenantModel.findOne({ tenantId: dto.tenantId });
    if (existing) {
      throw new ConflictException(
        `Tenant with id '${dto.tenantId}' already exists`,
      );
    }

    const tenant = await this.tenantModel.create({
      tenantId: dto.tenantId,
      name: dto.name,
      status: 'provisioning',
      database: {
        engine: dto.engine,
        uri: dto.databaseUri,  // will be encrypted in Module Phase when EncryptionService exists
        poolMin: dto.poolMin ?? 2,
        poolMax: dto.poolMax ?? 10,
      },
    });

    this.logger.log(`Tenant created: ${tenant.tenantId} (status: provisioning)`);
    return tenant;
  }

  async findById(tenantId: string): Promise<TenantMetadataDocument> {
    const tenant = await this.tenantModel.findOne({ tenantId });
    if (!tenant) {
      throw new NotFoundException(`Tenant '${tenantId}' not found`);
    }
    return tenant;
  }

  async findAll(): Promise<TenantMetadataDocument[]> {
    return this.tenantModel.find().sort({ createdAt: -1 });
  }

  async update(
    tenantId: string,
    dto: UpdateTenantDto,
  ): Promise<TenantMetadataDocument> {
    const tenant = await this.requireTenant(tenantId);

    if (dto.name) tenant.name = dto.name;
    if (dto.config) {
      // Deep merge of config to avoid overwriting keys not sent
      tenant.config = this.deepMerge(
        tenant.config as Record<string, unknown>,
        dto.config,
      );
    }

    await tenant.save();
    await this.invalidateCache(tenantId);

    return tenant;
  }

  async delete(tenantId: string): Promise<void> {
    const tenant = await this.requireTenant(tenantId);

    // Only archived tenants can be deleted
    // This prevents accidental deletion of active tenants
    if (tenant.status !== 'archived') {
      throw new BadRequestException(
        `Tenant must be archived before deletion. Current status: ${tenant.status}`,
      );
    }

    await this.tenantModel.deleteOne({ tenantId });
    await this.invalidateCache(tenantId);
    this.logger.warn(`Tenant permanently deleted: ${tenantId}`);
  }

  // ─── Lifecycle Transitions ────────────────────────────────────────────────

  async activate(tenantId: string): Promise<TenantMetadataDocument> {
    const tenant = await this.requireTenant(tenantId);

    this.assertTransitionAllowed(tenant.status, 'active', ['provisioning', 'suspended']);

    // In Phase 1: simple state change
    // In Module Phase: here it will call ProvisionerService and EncryptionService
    tenant.status = 'active';
    await tenant.save();
    await this.invalidateCache(tenantId);

    this.logger.log(`Tenant activated: ${tenantId}`);
    return tenant;
  }

  async suspend(tenantId: string): Promise<TenantMetadataDocument> {
    const tenant = await this.requireTenant(tenantId);
    this.assertTransitionAllowed(tenant.status, 'suspended', ['active']);

    tenant.status = 'suspended';
    await tenant.save();
    await this.invalidateCache(tenantId);

    this.logger.warn(`Tenant suspended: ${tenantId}`);
    return tenant;
  }

  async archive(tenantId: string): Promise<TenantMetadataDocument> {
    const tenant = await this.requireTenant(tenantId);
    this.assertTransitionAllowed(tenant.status, 'archived', ['active', 'suspended']);

    tenant.status = 'archived';
    await tenant.save();
    await this.invalidateCache(tenantId);

    this.logger.warn(`Tenant archived: ${tenantId}`);
    return tenant;
  }

  // ─── Cache ────────────────────────────────────────────────────────────────

  // This method is used by the TenantInterceptor in Phase 3
  // For Phase 1 it serves to validate that Redis works correctly
  async getMasterDocument(tenantId: string): Promise<TenantMetadataDocument> {
    const cacheKey = `tenant:${tenantId}:master-document`;

    // Try Redis first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache HIT for tenant: ${tenantId}`);
      return JSON.parse(cached) as TenantMetadataDocument;
    }

    // Fallback to MongoDB
    this.logger.debug(`Cache MISS for tenant: ${tenantId}`);
    const tenant = await this.findById(tenantId);

    // Cache with TTL
    await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(tenant));

    return tenant;
  }

  async invalidateCache(tenantId: string): Promise<void> {
    const cacheKey = `tenant:${tenantId}:master-document`;
    await this.redis.del(cacheKey);
    this.logger.debug(`Cache invalidated for tenant: ${tenantId}`);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private async requireTenant(tenantId: string): Promise<TenantMetadataDocument> {
    const tenant = await this.tenantModel.findOne({ tenantId });
    if (!tenant) {
      throw new NotFoundException(`Tenant '${tenantId}' not found`);
    }
    return tenant;
  }

  private assertTransitionAllowed(
    current: TenantStatus,
    target: TenantStatus,
    allowedFrom: TenantStatus[],
  ): void {
    if (!allowedFrom.includes(current)) {
      throw new BadRequestException(
        `Cannot transition tenant from '${current}' to '${target}'. ` +
        `Allowed source states: ${allowedFrom.join(', ')}`,
      );
    }
  }

  // Deep merge for partial config updates
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object'
      ) {
        result[key] = this.deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>,
        );
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
}
```

---

#### `src/modules/control-plane/tenant/tenant.controller.ts`

```typescript
import {
  Controller, Get, Post, Put, Delete, Param,
  Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';

@ApiTags('Control Plane — Tenants')
@Controller('control-plane/tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant (status: provisioning)' })
  @ApiResponse({ status: 201, description: 'Tenant created' })
  @ApiResponse({ status: 409, description: 'tenantId already exists' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants' })
  findAll() {
    return this.tenantService.findAll();
  }

  @Get(':tenantId')
  @ApiOperation({ summary: 'Get Master Document for a tenant' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findOne(@Param('tenantId') tenantId: string) {
    return this.tenantService.findById(tenantId);
  }

  @Put(':tenantId')
  @ApiOperation({ summary: 'Update tenant name or config' })
  update(@Param('tenantId') tenantId: string, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(tenantId, dto);
  }

  @Delete(':tenantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete an archived tenant' })
  remove(@Param('tenantId') tenantId: string) {
    return this.tenantService.delete(tenantId);
  }

  // ─── Lifecycle endpoints ─────────────────────────────────────────────────

  @Post(':tenantId/activate')
  @ApiOperation({ summary: 'Activate tenant (provisioning/suspended → active)' })
  activate(@Param('tenantId') tenantId: string) {
    return this.tenantService.activate(tenantId);
  }

  @Post(':tenantId/suspend')
  @ApiOperation({ summary: 'Suspend tenant (active → suspended)' })
  suspend(@Param('tenantId') tenantId: string) {
    return this.tenantService.suspend(tenantId);
  }

  @Post(':tenantId/archive')
  @ApiOperation({ summary: 'Archive tenant (active/suspended → archived)' })
  archive(@Param('tenantId') tenantId: string) {
    return this.tenantService.archive(tenantId);
  }

  // Cache management — useful for debugging and maintenance operations
  @Post(':tenantId/cache/invalidate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Manually invalidate tenant cache in Redis' })
  invalidateCache(@Param('tenantId') tenantId: string) {
    return this.tenantService.invalidateCache(tenantId);
  }
}
```

---

#### `src/modules/control-plane/metadata/schema-version.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SchemaVersionDocument = SchemaVersion & Document;

@Schema({
  timestamps: true,
  collection: 'schema_versions',
})
export class SchemaVersion {
  @Prop({ required: true, index: true })
  tenantId: string;

  // Version number — allows ordering and rollback to a specific version
  @Prop({ required: true })
  version: number;

  // Full snapshot of the UniversalSchemaMap at this point
  @Prop({ type: Object, required: true })
  schema: Record<string, unknown>;

  // Who made the change and why (for Control Plane auditing)
  @Prop({ type: String, default: 'manual' })
  changedBy: string;

  @Prop({ type: String })
  changeDescription?: string;

  createdAt?: Date;
}

export const SchemaVersionSchema = SchemaFactory.createForClass(SchemaVersion);

// Composite index for queries like "give me the versions of tenant X"
SchemaVersionSchema.index({ tenantId: 1, version: -1 });
// Uniqueness constraint: no duplicate version for a tenant
SchemaVersionSchema.index({ tenantId: 1, version: 1 }, { unique: true });
```

---

#### `src/modules/control-plane/metadata/dto/metadata.dto.ts`

```typescript
import { IsObject, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSchemaDto {
  @ApiProperty({
    description: 'Partial or full UniversalSchemaMap to merge into the tenant schema',
    example: {
      orders: {
        fields: {
          status: { type: 'string', required: true },
          total: { type: 'decimal', required: true },
        },
        timestamps: true,
      },
    },
  })
  @IsObject()
  schema: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Added orders entity' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  changeDescription?: string;
}

export class RollbackSchemaDto {
  // The target version number is passed as a URL parameter, not in the body
  // This DTO can be used if we need to add rollback options in the future
}
```

---

#### `src/modules/control-plane/metadata/metadata.service.ts`

```typescript
import {
  Injectable, NotFoundException, BadRequestException, Logger, Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  TenantMetadata, TenantMetadataDocument,
} from '../tenant/tenant.schema';
import {
  SchemaVersion, SchemaVersionDocument,
} from './schema-version.schema';
import { UpdateSchemaDto } from './dto/metadata.dto';
import { REDIS_CLIENT } from '../../../infrastructure/cache/cache.module';

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    @InjectModel(TenantMetadata.name)
    private readonly tenantModel: Model<TenantMetadataDocument>,
    @InjectModel(SchemaVersion.name)
    private readonly schemaVersionModel: Model<SchemaVersionDocument>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // ─── Schema CRUD ──────────────────────────────────────────────────────────

  async getSchema(tenantId: string): Promise<Record<string, unknown>> {
    const tenant = await this.requireTenant(tenantId);
    return tenant.schema as Record<string, unknown>;
  }

  async updateSchema(
    tenantId: string,
    dto: UpdateSchemaDto,
    changedBy = 'system',
  ): Promise<TenantMetadataDocument> {
    const tenant = await this.requireTenant(tenantId);

    // 1. Save snapshot of the current version BEFORE modifying
    await this.saveVersionSnapshot(tenant, changedBy, dto.changeDescription);

    // 2. Merge the new schema with the existing one
    const currentSchema = (tenant.schema as Record<string, unknown>) ?? {};
    tenant.schema = { ...currentSchema, ...dto.schema };

    // 3. Increment version
    tenant.version = (tenant.version ?? 1) + 1;
    await tenant.save();

    // 4. Invalidate cache — CRITICAL: any subsequent request must get the new schema
    await this.invalidateCache(tenantId);

    this.logger.log(
      `Schema updated for tenant ${tenantId} → version ${tenant.version}`,
    );

    return tenant;
  }

  async addEntity(
    tenantId: string,
    entityName: string,
    entityDefinition: Record<string, unknown>,
    changedBy = 'system',
  ): Promise<TenantMetadataDocument> {
    const tenant = await this.requireTenant(tenantId);
    const currentSchema = (tenant.schema as Record<string, unknown>) ?? {};

    if (currentSchema[entityName]) {
      throw new BadRequestException(
        `Entity '${entityName}' already exists in tenant schema. ` +
        `Use updateSchema to modify an existing entity.`,
      );
    }

    return this.updateSchema(
      tenantId,
      { schema: { ...currentSchema, [entityName]: entityDefinition } },
      changedBy,
    );
  }

  async removeEntity(
    tenantId: string,
    entityName: string,
    changedBy = 'system',
  ): Promise<TenantMetadataDocument> {
    const tenant = await this.requireTenant(tenantId);
    const currentSchema = { ...(tenant.schema as Record<string, unknown>) };

    if (!currentSchema[entityName]) {
      throw new NotFoundException(
        `Entity '${entityName}' not found in tenant schema`,
      );
    }

    delete currentSchema[entityName];

    return this.updateSchema(tenantId, { schema: currentSchema }, changedBy);
  }

  // ─── Version History ──────────────────────────────────────────────────────

  async getVersionHistory(tenantId: string): Promise<SchemaVersionDocument[]> {
    await this.requireTenant(tenantId); // verify that tenant exists
    return this.schemaVersionModel
      .find({ tenantId })
      .sort({ version: -1 })
      .limit(50); // latest 50 versions
  }

  async getVersion(
    tenantId: string,
    version: number,
  ): Promise<SchemaVersionDocument> {
    const snapshot = await this.schemaVersionModel.findOne({ tenantId, version });
    if (!snapshot) {
      throw new NotFoundException(
        `Schema version ${version} not found for tenant '${tenantId}'`,
      );
    }
    return snapshot;
  }

  async rollbackToVersion(
    tenantId: string,
    targetVersion: number,
    changedBy = 'system',
  ): Promise<TenantMetadataDocument> {
    const tenant = await this.requireTenant(tenantId);
    const snapshot = await this.getVersion(tenantId, targetVersion);

    if (targetVersion >= tenant.version) {
      throw new BadRequestException(
        `Cannot rollback to version ${targetVersion}: current version is ${tenant.version}. ` +
        `Rollback target must be lower than current version.`,
      );
    }

    // Save snapshot of the current state before rolling back
    await this.saveVersionSnapshot(
      tenant,
      changedBy,
      `Rollback to version ${targetVersion}`,
    );

    // Restore the schema from the snapshot
    tenant.schema = snapshot.schema;
    tenant.version = (tenant.version ?? 1) + 1; // still increment — we never go backwards
    await tenant.save();
    await this.invalidateCache(tenantId);

    this.logger.warn(
      `Schema rolled back for tenant ${tenantId} ` +
      `(target: v${targetVersion}, new version: v${tenant.version})`,
    );

    return tenant;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async requireTenant(tenantId: string): Promise<TenantMetadataDocument> {
    const tenant = await this.tenantModel.findOne({ tenantId });
    if (!tenant) {
      throw new NotFoundException(`Tenant '${tenantId}' not found`);
    }
    return tenant;
  }

  private async saveVersionSnapshot(
    tenant: TenantMetadataDocument,
    changedBy: string,
    description?: string,
  ): Promise<void> {
    await this.schemaVersionModel.create({
      tenantId: tenant.tenantId,
      version: tenant.version,
      schema: tenant.schema,
      changedBy,
      changeDescription: description,
    });
  }

  private async invalidateCache(tenantId: string): Promise<void> {
    const cacheKey = `tenant:${tenantId}:master-document`;
    await this.redis.del(cacheKey);
  }
}
```

---

#### `src/modules/control-plane/metadata/metadata.controller.ts`

```typescript
import {
  Controller, Get, Put, Post, Delete,
  Param, Body, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MetadataService } from './metadata.service';
import { UpdateSchemaDto } from './dto/metadata.dto';

@ApiTags('Control Plane — Schema Metadata')
@Controller('control-plane/tenants/:tenantId/schema')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get()
  @ApiOperation({ summary: 'Get current UniversalSchemaMap for a tenant' })
  getSchema(@Param('tenantId') tenantId: string) {
    return this.metadataService.getSchema(tenantId);
  }

  @Put()
  @ApiOperation({ summary: 'Merge/update schema (auto-increments version)' })
  updateSchema(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateSchemaDto,
  ) {
    return this.metadataService.updateSchema(tenantId, dto);
  }

  @Post('entities/:entityName')
  @ApiOperation({ summary: 'Add a new entity to the schema' })
  addEntity(
    @Param('tenantId') tenantId: string,
    @Param('entityName') entityName: string,
    @Body() entityDefinition: Record<string, unknown>,
  ) {
    return this.metadataService.addEntity(tenantId, entityName, entityDefinition);
  }

  @Delete('entities/:entityName')
  @ApiOperation({ summary: 'Remove an entity from the schema' })
  removeEntity(
    @Param('tenantId') tenantId: string,
    @Param('entityName') entityName: string,
  ) {
    return this.metadataService.removeEntity(tenantId, entityName);
  }

  @Get('versions')
  @ApiOperation({ summary: 'Get schema version history (last 50)' })
  getVersionHistory(@Param('tenantId') tenantId: string) {
    return this.metadataService.getVersionHistory(tenantId);
  }

  @Get('versions/:version')
  @ApiOperation({ summary: 'Get a specific schema version snapshot' })
  getVersion(
    @Param('tenantId') tenantId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.metadataService.getVersion(tenantId, version);
  }

  @Post('versions/:version/rollback')
  @ApiOperation({ summary: 'Rollback schema to a previous version' })
  rollback(
    @Param('tenantId') tenantId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.metadataService.rollbackToVersion(tenantId, version);
  }
}
```

---

#### `src/modules/control-plane/control-plane.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantMetadata, TenantMetadataSchema } from './tenant/tenant.schema';
import { SchemaVersion, SchemaVersionSchema } from './metadata/schema-version.schema';
import { TenantService } from './tenant/tenant.service';
import { TenantController } from './tenant/tenant.controller';
import { MetadataService } from './metadata/metadata.service';
import { MetadataController } from './metadata/metadata.controller';
import { IamModule } from './iam/iam.module';
import { ProvisionerModule } from './provisioner/provisioner.module';

@Module({
  imports: [
    // Register the Mongoose schemas in this module
    MongooseModule.forFeature([
      { name: TenantMetadata.name, schema: TenantMetadataSchema },
      { name: SchemaVersion.name, schema: SchemaVersionSchema },
    ]),
    IamModule,
    ProvisionerModule,
  ],
  controllers: [TenantController, MetadataController],
  providers: [TenantService, MetadataService],
  // Export services so other modules can inject them
  // The TenantInterceptor (Phase 3) will need TenantService
  exports: [TenantService, MetadataService],
})
export class ControlPlaneModule {}
```

---

#### `app.module.ts` updated at the end of Phase 1

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

// Infrastructure
import { SystemDbModule } from './infrastructure/system-db/system-db.module';
import { CacheModule } from './infrastructure/cache/cache.module';

// Control Plane
import { ControlPlaneModule } from './modules/control-plane/control-plane.module';

// Other modules (Phase 0 stubs — activated in their respective phases)
// import { EnginesModule } from './modules/engines/engines.module';
// import { DataPlaneModule } from './modules/data-plane/data-plane.module';
// ... (commented out until their phase)

import { HealthController } from './health.controller';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // Infrastructure — ORDER MATTERS: SystemDb and Cache first
    SystemDbModule,
    CacheModule,

    // Control Plane
    ControlPlaneModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

---

### Section 4 — Docker Compose

```yaml
# docker-compose.dev.yml (at the project root or in apps/backend/)
version: '3.9'

services:

  # ─── Control Plane Database ─────────────────────────────────────────────
  mongodb:
    image: mongo:7
    container_name: mini-baas-mongodb
    restart: unless-stopped
    ports:
      - '27017:27017'
    environment:
      MONGO_INITDB_DATABASE: mini_baas_control
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: ['CMD', 'mongosh', '--eval', 'db.adminCommand("ping")']
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Default SQL Tenant Database (for Phase 2+ tests) ─────────────────
  db:
    image: postgres:16-alpine
    container_name: mini-baas-postgres
    restart: unless-stopped
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: baas
      POSTGRES_PASSWORD: baas_dev_password
      POSTGRES_DB: tenant_default
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U baas -d tenant_default']
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Cache ──────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: mini-baas-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 3s
      retries: 5

  # ─── Email Catcher (dev only) ────────────────────────────────────────────
  mailpit:
    image: axllent/mailpit:latest
    container_name: mini-baas-mailpit
    restart: unless-stopped
    ports:
      - '1025:1025'   # SMTP
      - '8025:8025'   # Web UI
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: '1'
      MP_SMTP_AUTH_ALLOW_INSECURE: '1'

  # ─── NestJS App (optional in dev — use pnpm start:dev outside Docker) ──
  # dev:
  #   build:
  #     context: ./apps/backend
  #     dockerfile: ../../docker/Dockerfile.dev
  #   ports:
  #     - '3000:3000'
  #   depends_on:
  #     mongodb: { condition: service_healthy }
  #     db: { condition: service_healthy }
  #     redis: { condition: service_healthy }
  #   env_file: ./apps/backend/.env

volumes:
  mongodb_data:
  postgres_data:
  redis_data:
```

---

### Section 5 — Environment Variables

Update `.env.example` with the new Phase 1 variables:

```bash
# ─── Server ────────────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# ─── Control Plane Database (MongoDB) ──────────────────────────────────────
# Docker: mongodb://localhost:27017
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=mini_baas_control

# ─── Cache (Redis) ──────────────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379

# ─── Cryptography ──────────────────────────────────────────────────────────
# NEVER commit the actual value — generate with: openssl rand -hex 32
MASTER_ENCRYPTION_KEY=replace_with_64_char_hex_string

# ─── Default SQL Tenant (for Phase 2 tests) ─────────────────────────────
# These values match docker-compose.dev.yml
DATABASE_URL=postgresql://baas:baas_dev_password@localhost:5432/tenant_default

# ─── Email (Mailpit in dev) ─────────────────────────────────────────────────
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@mini-baas.dev
```

---

### Section 6 — Execution Sequence

```bash
# 1. Working branch
git checkout -b feat/phase-1-control-plane

# 2. Install new Phase 1 dependencies
cd apps/backend
pnpm add @nestjs/mongoose mongoose

# 3. Bring up infrastructure
docker compose -f docker-compose.dev.yml up -d
# Verify that all 4 services are healthy:
docker compose -f docker-compose.dev.yml ps

# 4. Create the files according to Section 3 (in the order listed)
# infrastructure/system-db/system-db.module.ts
# infrastructure/cache/cache.module.ts
# modules/control-plane/tenant/tenant.schema.ts
# modules/control-plane/tenant/dto/tenant.dto.ts
# modules/control-plane/tenant/tenant.service.ts
# modules/control-plane/tenant/tenant.controller.ts
# modules/control-plane/metadata/schema-version.schema.ts
# modules/control-plane/metadata/dto/metadata.dto.ts
# modules/control-plane/metadata/metadata.service.ts
# modules/control-plane/metadata/metadata.controller.ts
# modules/control-plane/control-plane.module.ts
# stubs for iam/ and provisioner/

# 5. Update app.module.ts

# 6. Compilation verification
npx tsc --noEmit    # MUST give 0 errors
nest build          # MUST compile without errors

# 7. Runtime verification
pnpm start:dev
curl localhost:3000/health   # → 200 OK

# 8. Manual endpoint tests
# (see section 7)

# 9. Commit
git add .
git commit -m "feat: phase-1 — Control Plane, TenantService, MetadataService, Redis cache, Docker Compose"
git push origin feat/phase-1-control-plane
```

---

### Section 7 — Manual Verification Tests

These tests are executed in order — each depends on the previous one.

```bash
BASE=http://localhost:3000/control-plane/tenants

# T1: Create tenant
curl -s -X POST $BASE \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-tenant-01",
    "name": "Test Tenant",
    "engine": "postgresql",
    "databaseUri": "postgresql://baas:baas_dev_password@localhost:5432/tenant_default"
  }' | jq .
# Expected: { tenantId: "test-tenant-01", status: "provisioning", version: 1 }

# T2: Try to create the same tenantId → must fail
curl -s -X POST $BASE \
  -H "Content-Type: application/json" \
  -d '{ "tenantId": "test-tenant-01", "name": "Duplicate", "engine": "postgresql", "databaseUri": "..." }' | jq .
# Expected: 409 Conflict

# T3: Get the tenant
curl -s $BASE/test-tenant-01 | jq .
# Expected: full document with status provisioning

# T4: Activate
curl -s -X POST $BASE/test-tenant-01/activate | jq .
# Expected: { status: "active" }

# T5: Try to activate again → must fail
curl -s -X POST $BASE/test-tenant-01/activate | jq .
# Expected: 400 Bad Request "Cannot transition from 'active' to 'active'"

# T6: Suspend
curl -s -X POST $BASE/test-tenant-01/suspend | jq .
# Expected: { status: "suspended" }

# T7: Reactivate
curl -s -X POST $BASE/test-tenant-01/activate | jq .
# Expected: { status: "active" }

# T8: Archive
curl -s -X POST $BASE/test-tenant-01/archive | jq .
# Expected: { status: "archived" }

# T9: Schema — add entity
curl -s -X POST "$BASE/test-tenant-01/schema/entities/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "status": { "type": "string", "required": true },
      "total": { "type": "decimal", "required": true }
    },
    "timestamps": true
  }' | jq .
# Expected: version incremented to 2

# T10: Version history
curl -s "$BASE/test-tenant-01/schema/versions" | jq .
# Expected: array with 1 entry (snapshot of version 1)

# T11: Rollback
curl -s -X POST "$BASE/test-tenant-01/schema/versions/1/rollback" | jq .
# Expected: schema reverts to v1 state, version now 3

# T12: Verify cache — the same GET should come from Redis the second time
curl -s $BASE/test-tenant-01/cache/invalidate  # invalidate first
curl -s "$BASE/test-tenant-01" | jq .          # first hit → MongoDB
curl -s "$BASE/test-tenant-01" | jq .          # second hit → Redis (verify in logs)
```

---

### Section 8 — PR Review Criteria

**Infrastructure**

- [ ] `SystemDbModule` is `@Global()` and exports `MongooseModule`
- [ ] `CacheModule` is `@Global()` and uses a `Symbol` for the injection token
- [ ] `docker-compose.dev.yml` has the 4 services with healthchecks
- [ ] All docker‑compose services show `healthy` with `docker compose ps`

**Control Plane — Tenant**

- [ ] `TenantMetadata` schema has indexes on `tenantId` and `status`
- [ ] `TenantService.create()` throws `ConflictException` for duplicate tenantId
- [ ] All invalid state transitions throw `BadRequestException` with a descriptive message
- [ ] `getMasterDocument()` does Redis‑first with fallback to MongoDB
- [ ] `invalidateCache()` is called on every operation that modifies the tenant

**Control Plane — Metadata**

- [ ] `SchemaVersion` schema has a composite index `(tenantId, version)` with uniqueness
- [ ] `updateSchema()` saves a snapshot BEFORE applying changes
- [ ] `rollbackToVersion()` rejects versions ≥ current version
- [ ] `rollbackToVersion()` always increments `version` (never goes backwards)

**TypeScript**

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] No implicit `any` in any new file

**Runtime**

- [ ] All tests T1–T12 pass
- [ ] Logs show `[Redis] Connected to cache` on startup
- [ ] Logs correctly show `Cache HIT` / `Cache MISS` during cache tests

---

### Section 9 — Pending Decisions (Do Not Block Phase 1, but Affect Module Phase)

| Decision | Impact | When to Resolve |
|---|---|---|
| Should the tenant database URI be encrypted in Phase 1 or in the Module Phase? | If encrypted in Phase 1, `TenantService.create()` would need `EncryptionService` already | Resolved in Module Phase — Phase 1 stores the URI in plain text with a `// TODO: encrypt` comment |
| Should Phase 1 `activate()` block if there is no connection to the tenant database? | Implies `activate()` does a `ping()` to the adapter — requires Phase 2 | Resolved in Module Phase when `activate()` is rewritten with the Provisioner |
| Authentication on Control Plane endpoints? | Without auth, anyone can create/suspend tenants | Admin guard added in Phase 7 (Security) — document with `// TODO: add AdminGuard` |

---

### Executive Summary of Phase 1

Phase 1 establishes the **brain of the system**. When it finishes, mini‑baas can create, manage, and persist tenants with their full configuration, complete with schema versioning and an operational Redis cache. None of the Data Plane exists yet — but the contract that the Data Plane will consume (the Master Document, the cache, `TenantService`) is fully defined and implemented.

| | Phase 0 | Phase 1 | Phase 2 |
|---|---|---|---|
| **Output** | Clean structure | Functional Control Plane | Polyglot adapters |
| **Verifies with** | `tsc --noEmit` | T1–T12 + `tsc --noEmit` | Polyglot parity test |
| **Enables** | Everything else | Phase 2 and Module Phase | Phases 3–11 |
| **Estimated duration** | 2–4h | 6–10h | 10–16h |