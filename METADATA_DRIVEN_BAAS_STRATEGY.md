# mini-baas — A Self-Adapting, Database-Agnostic Backend-as-a-Service

> **Core principle:** We are not building an app. We are building an App Factory.  
> Our backend must transform itself at runtime to serve any business model it has never seen before — without a single line of hardcoded schema, controller, or model.

---

## 1. Key Concepts & Architecture

### Metadata-Driven Architecture
Most backends are static: a developer writes a schema and deploys. This breaks completely for a platform like ours. **The backend has zero knowledge of any user's data model at build time.** Instead of hardcoded ORM models (like Prisma or TypeORM entities), users define their data model as JSON metadata. This "Master Document" is stored in our **System DB**. At request time, NestJS reads this metadata, builds a runtime validator, and generates a dynamic query builder on the fly. The backend *becomes* the right backend for each user, on every request.

#### 📄 Example: The "Master Document" (The Tenant's DNA)
This JSON document represents everything the Data Plane needs to know to serve a specific tenant. It replaces static code completely.

    {
      "_id": "64a7b...89c",
      "tenantId": "ws_123",
      "status": "active",
      "database": {
        "engine": "postgresql",
        "uri": "postgres://user:pass@db.example.com:5432/tenant_db"
      },
      "schema": {
        "books": {
          "fields": {
            "title": { "type": "string", "required": true },
            "price": { "type": "number", "default": 0 }
          }
        }
      },
      "hooks": {
        "books": {
          "beforeCreate": "function(data) { if(data.price < 0) throw new Error('Invalid price'); return data; }"
        }
      },
      "permissions": {
        "books": { "read": ["public", "admin"], "create": ["admin"] }
      },
      "version": 1
    }

#### 💻 Example: Control Plane Implementation (Mongoose)
To store this flexible, schema-less structure in our System DB, we use MongoDB and Mongoose. Here is how the schema is defined in the Control Plane:

    import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
    import { Document, Schema as MongooseSchema } from 'mongoose';

    @Schema({ timestamps: true })
    export class TenantMetadata extends Document {
      @Prop({ required: true, unique: true, index: true })
      tenantId: string; // e.g., 'ws_123'

      @Prop({ required: true })
      status: string; // 'active', 'suspended'

      @Prop({ type: MongooseSchema.Types.Mixed, required: true })
      database: { engine: 'postgresql' | 'mongodb' | 'mysql'; uri: string };

      @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
      schema: Record<string, any>; // The dynamic dictionary of tables/collections

      @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
      hooks: Record<string, any>; // JS code stored as text for isolated-vm

      @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
      permissions: Record<string, any>; // RBAC/ABAC rules

      @Prop({ default: 1 })
      version: number;
    }

    export const TenantMetadataSchema = SchemaFactory.createForClass(TenantMetadata);

*(Reference: [https://mongoosejs.com/docs/schematypes.html#mixed](https://mongoosejs.com/docs/schematypes.html#mixed) )*

### Multi-Tenant Isolation Strategy
To securely serve unbounded tenant diversity, the platform is strictly divided into two macro domains:
* **The Control Plane:** Responsible for governance. It manages tenant lifecycles, billing, policies, and stores the metadata (the schema definitions and configurations). Control plane failure must *not* break data plane execution.
* **The Data Plane:** The stateless, horizontally scalable runtime that executes user workloads. It caches metadata, validates incoming data, and injects the right database adapter per request.

**Isolation is enforced at three layers:**
1.  **Data Isolation Strategy:** A hybrid model: Shared DB + Separate Schemas. Small tenants use a Shared DB with Row-Level Security (or tenant-ID scopes). Enterprise tenants get a dedicated database.
2.  **Compute Isolation:** Strict resource quotas and the use of sandboxed environments for custom user code.
3.  **Cache Isolation:** Every cache key in Redis is strictly namespaced (e.g., `tenant:ws_123:metadata`).

---

## 2. Technology Stack

To achieve this dynamic behavior, we selected a stack optimized for modularity, runtime flexibility, and isolation.

| Layer | Technology | Why it's the right choice | Docs |
|-------|------------|---------------------------|------|
| **Framework** | NestJS (TypeScript) | Its powerful Dependency Injection (DI) and Request-Scoped providers are essential for implementing the Adapter Pattern. It allows us to inject a different DB engine per request. | NestJS |
| **System DB** | MongoDB & Mongoose | Perfect for the Control Plane. Schemas (metadata) are inherently dynamic, nested JSON objects. A document database allows us to store and evolve tenant configurations without writing SQL migrations. | MongoDB |
| **SQL Engine** | Knex.js | A dynamic query builder. Since we don't have static models, Knex allows us to construct complex SQL queries (SELECT, JOIN) from abstract JSON syntax trees at runtime. | Knex.js |
| **NoSQL Engine** | MongoDB Native Driver | Provides direct, schema-free collection access for tenants bringing their own NoSQL databases. | Mongo Node |
| **Validation** | AJV / Zod | Since we lack TypeScript DTOs, these tools allow us to compile validation schemas directly from the stored JSON metadata at runtime to secure the Data Plane. | Zod |
| **Sandbox** | isolated-vm | Safely executes user-defined JavaScript hooks (onCreate, onUpdate). It creates a secure V8 isolate so untrusted user code cannot access or crash our Node.js environment. | isolated-vm |
| **Cache & Jobs** | Redis + BullMQ | Tenant-aware caching for metadata (crucial for performance) and async task queues for webhooks and background jobs. | BullMQ |

---

## 3. Request Flow & Orchestration

How do these technologies connect? Let's trace the lifecycle of a single request: `POST /api/ws_123/books`

1.  **Intercept & Context (NestJS + Redis):** The `TenantInterceptor` reads the `ws_123` ID from the URL/Header. It checks **Redis** for the tenant's cached metadata. If missing, it fetches the "Master Document" from the **MongoDB System DB** and caches it.
2.  **Adapter Injection (NestJS DI):** The `DatabaseProvider Factory` reads the tenant's config (`dbType: "postgresql"`). NestJS dynamically instantiates the `PostgresAdapter` with the tenant's connection string and injects it into the request scope.
3.  **Dynamic Validation (AJV/Zod):** The `DynamicController` receives the generic payload. The `ValidationEngine` extracts the `books` schema from the metadata, compiles it into a Zod/AJV rule, and validates the incoming JSON body.
4.  **Query Execution (Knex / Mongo Driver):** The `DynamicService` calls `this.db.create('books', validatedData)`. The `PostgresAdapter` uses **Knex.js** to translate this into an `INSERT INTO books...` SQL statement and executes it against the external tenant database.
5.  **Hook Execution (isolated-vm):** If the metadata defines an `afterCreate` hook, the `HookRuntime` spins up a secure V8 isolate via **isolated-vm**, injects the newly created record, and executes the user's custom JavaScript function.
6.  **Response:** The `TransformLayer` normalizes the result and returns a consistent JSON payload to the client.

---

## 4. Modular Directory Structure (Domain-Driven Design)

To maintain sanity and scalability, the codebase enforces strict boundaries. Engines know nothing about HTTP, and Controllers know nothing about SQL.

    src/
    ├── main.ts                     # Application entry point
    ├── app.module.ts               # Root module assembling the App Factory
    │
    ├── common/                     # Shared tools (Business-agnostic)
    │   ├── interceptors/           # e.g., TenantInterceptor (resolves tenant context)
    │   ├── interfaces/             # e.g., IDatabaseAdapter contract
    │   └── exceptions/             # Global error filters
    │
    ├── modules/                    # Core Application Modules
    │   │
    │   ├── control-plane/          # GOVERNANCE (No tenant data touches here)
    │   │   ├── tenant/             # Tenant lifecycle and DB credential management
    │   │   ├── metadata/           # CRUD for schema definitions (The Master Documents)
    │   │   └── iam/                # Auth & Policy Engine (RBAC/ABAC definitions)
    │   │
    │   ├── data-plane/             # EXECUTION (Stateless runtime)
    │   │   ├── dynamic-api/        # The single DynamicController & DynamicService
    │   │   ├── validation/         # Zod/AJV dynamic schema compilers
    │   │   └── transformation/     # Payload normalizers
    │   │
    │   ├── engines/                # THE ADAPTERS (Database agnostic translators)
    │   │   ├── core/               # DatabaseProvider Factory
    │   │   ├── sql/                # Knex.js implementation
    │   │   └── nosql/              # MongoDB Native implementation
    │   │
    │   └── runtime/                # CUSTOM LOGIC (User-defined operations)
    │       ├── hooks/              # isolated-vm sandbox manager
    │       └── background-jobs/    # BullMQ async workers
    │
    └── infrastructure/             # INTERNAL SERVICES
        ├── cache/                  # Redis connection manager
        └── system-db/              # MongoDB/Mongoose connection for the Control Plane

---

## 5. System Maturity Stages (Action Plan)

Building an App Factory requires pragmatic, incremental steps. We cannot build the Query DSL and the Hook Sandbox simultaneously.

### Stage 1: Logical Multi-Tenancy & Metadata Foundation
* Setup NestJS with the modular DDD structure.
* Implement the `infrastructure/system-db` using **MongoDB** to store the `TenantMetadata` JSON.
* Implement the `TenantInterceptor` to resolve tenant context from requests.

### Stage 2: The Adapter Pattern & Basic Data Plane
* Define the `IDatabaseAdapter` interface.
* Implement a basic `SqlEngine` (Knex) and `NoSqlEngine` (Mongo).
* Create the `DynamicController` capable of routing basic CRUD operations to the correct injected adapter.

### Stage 3: Dynamic Validation
* Integrate Zod or AJV in the `data-plane/validation` module.
* Ensure that every `POST` or `PATCH` request is validated against the specific schema defined in the tenant's MongoDB metadata document.

### Stage 4: Advanced Query DSL & Relations
* Evolve the `DynamicService` to understand an internal Query DSL (filtering, sorting, pagination).
* Implement translation logic in the Adapters to convert the DSL into complex SQL Joins or Mongo Aggregations.

### Stage 5: Hook Execution & Billing
* Integrate `isolated-vm` to allow users to save and execute custom JS code securely.
* Implement usage accumulators (telemetry) in the Data Plane and send events to the Control Plane for billing computation.
