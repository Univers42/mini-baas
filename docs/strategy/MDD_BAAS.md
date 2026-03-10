# mini-baas — A Self-Adapting, Database-Agnostic Backend-as-a-Service

> **Core principle:** We are not building an app. We are building an App Factory.  
> Our backend must transform itself at runtime to serve any business model it has never seen before — without a single line of hardcoded schema, controller, or model.

---

## 1. Preamble: The Horizon and Our Objective

The goal of **mini-baas** is not to build a traditional REST API, but to design an **App Factory**: a dynamic engine capable of provisioning, isolating, and serving multiple applications (Tenants) from a single shared infrastructure. 

We seek to democratize backend development by allowing users to define their data schemas and business logic through configurations (metadata), without the need to write server code or manage deployments. The main challenge is to achieve a perfect balance between **flexibility for the user**, **system performance**, and **security isolation (multi-tenancy)**.

To reach this horizon, it is imperative to reflect on the architectural paradigms available in the industry and justify our technological choices.

---

## 2. Analysis of Architectural Alternatives

There are three major paths in the industry to solve the construction of a BaaS. Each assumes radically different tradeoffs.

### Alternative A: Code and Infrastructure Generation (The Supabase Model)
The system does not interpret metadata in real-time but acts as a DevOps orchestrator. When creating a Tenant, it deploys dedicated containers and automatically generates REST/GraphQL APIs on top of an isolated physical database.
* **Pros:** Native performance (no runtime abstraction layers) and perfect security isolation (Hard Isolation).
* **Cons:** Infrastructure costs skyrocket. Requires a complex Kubernetes ecosystem to manage the lifecycle of thousands of idle containers (scale-to-zero).

### Alternative B: Serverless Edge (The Firebase / Cloudflare Model)
The central backend container is eliminated. Each Tenant's logic is deployed as Serverless functions at the network edge, connected to a globally distributed NoSQL database.
* **Pros:** Infinite scalability and minimal latency for the end user.
* **Cons:** Extreme Vendor Lock-in. It is nearly impossible to deploy this architecture in a local environment (self-hosted) without relying on AWS, Vercel, or Cloudflare.

### Alternative C: Pure NoSQL / Schema-less (The Original Parse / Appwrite Model)
The complexity of mapping relational schemas is eliminated. The entire system (metadata and client data) lives in a document-oriented database (MongoDB).
* **Pros:** Maximum iteration speed. Saving data with dynamic shapes is trivial without the need for migrations (`ALTER TABLE`).
* **Cons:** Weak data integrity. The advantages of relational databases (efficient JOINs, strict ACID transactions) are lost. High risk of the "Noisy Neighbor" problem.

---

### 2.1 Strategic Alignment: The "42 ft_transcendence" Challenge
In the specific context of the 42 **ft_transcendence** project, architectural choices are not just about performance, but about strategic point acquisition and evaluation survival. The subject mandates a 14-point requirement utilizing diverse modules. 

While most students default to a standard static monolith (which is "safe" but scores low on technical complexity) or microservices (which have a high failure rate during Docker orchestration evaluations), our **Metadata-Driven App Factory** acts as a "Master Key" to natively unlock the highest-value modules.



#### The 14-Point Target Matrix
Our architecture natively aligns with several Major (2 pt) and Minor (1 pt) requirements by design:

| Module / Requirement | Metadata-Driven (Ours) | Code Gen / Microservices | Pure Serverless |
| :--- | :--- | :--- | :--- |
| **III.2 Docker (Single Command)** | ✅ **Perfect** (One `docker-compose`) | ❌ Very Difficult | ❌ Impossible |
| **IV.1 Web Frameworks (Major)** | ✅ **2 pts** (NestJS + React) | ✅ Yes | ❌ No |
| **IV.1 Public API (Major)** | 💎 **2 pts** (Native to BaaS design) | ⚠️ Requires manual build | ✅ Yes |
| **IV.3 Organization System (Major)**| 💎 **2 pts** (Native Tenant logic) | ⚠️ Complex | ✅ Easy |
| **IV.10 Custom Module (Major)** | 🏆 **2 pts** (The AST / Metadata Engine itself) | ⚠️ Standard | ❌ No |

*With just the core BaaS functionality, standard Auth, and real-time WebSockets, the 14-point threshold is easily surpassed.*

#### ⚠️ Critical Warning: The "Database Schema" Danger
The transcendence subject explicitly states: *"The database must have a clear schema and well-defined relations."*
This is the single biggest threat to Alternative C (Pure NoSQL). If we rely purely on MongoDB's schema-less nature and `Mixed` fields, strict evaluators may reject the project for lacking "well-defined relations."
**The Solution:** Our strategy mitigates this by enforcing strict Mongoose schemas for the **Control Plane** (documenting the metadata structure clearly) and utilizing the **Adapter Pattern** (Phase 2) to connect a PostgreSQL **Data Plane**. This guarantees we can present a classic Entity-Relationship (ER) diagram during the evaluation, securing the mandatory database requirement.

---

## 3. Our Strategy: Metadata-Driven BaaS

After evaluating the alternatives, the chosen strategy for `mini-baas` is the **Metadata-Driven BaaS** implemented on a modular monolith (NestJS). 

In this model, a single fleet of application containers serves all Tenants. The API's behavior (routes, validations, database connections) mutates at runtime by reading a **Master Document** (JSON) stored in the Control Plane.

### Why is this the ideal strategy in our context?
1. **Resource Efficiency:** We keep infrastructure costs low. A single server can handle hundreds of idle Tenants at no additional cost.
2. **Technological Independence (Self-Hosting):** The entire infrastructure can be spun up with a simple `docker-compose`, ensuring the project is portable and auditable.
3. **Total Control:** By using Node.js with `isolated-vm`, we maintain absolute control over the execution of client Hooks without relying on third-party Serverless functions.

### 3.1 Critical Technical Risks (The "Devil's Advocate" Reality Check)
While powerful, this architecture introduces severe engineering challenges that must be mitigated:
* **The "Just-in-Time Validation" Bottleneck:** Compiling Zod/AJV schemas on-the-fly for every request will saturate the Node.js event loop. *Mitigation:* We require a strict Redis pre-warming strategy to avoid "Cold Start" latency spikes.
* **The `isolated-vm` Memory Trap:** V8 isolates provide security but consume significant RAM. A malicious or poorly written tenant hook (e.g., an infinite loop) can cause an Out-Of-Memory (OOM) crash for the entire API. *Mitigation:* Implementation of strict CPU/Memory quotas and pre-warmed Isolate pools.
* **Observability Hell:** In a dynamic environment, standard stack traces are useless. *Mitigation:* Distributed tracing is mandatory from Day 1. Every log and database query must be tagged with the `tenantId` and a `correlationId`.

### Tradeoff Matrix

| Paradigm | Code Complexity | Infra Complexity | Schema Flexibility | Self-Hosting (Local) |
| :--- | :--- | :--- | :--- | :--- |
| **Metadata-Driven (Ours)** | **High** (Dynamic interpreters) | **Medium** (Docker / NestJS) | **Medium** (Requires adapters) | **Excellent** |
| Code Generation (Supabase) | Low (Standard code) | Very High (Kubernetes) | Low (Requires migrations) | Complex |
| Serverless Edge (Firebase) | Medium | Low (Managed Cloud) | High (Distributed NoSQL) | Impossible / Simulated |
| Pure NoSQL (Parse) | Very Low | Low (MongoDB only) | Maximum | Excellent |

---

## 4. The Universal Abstraction Engine (Reality Check & Pivot)

For the Metadata-Driven model to be truly powerful, the system must eventually hide the complexity of the underlying database from the Tenant via a true agnostic adapter.

### The Illusion of "Universal Abstraction"
Initially, aiming for immediate SQL-to-NoSQL translation creates a "Lowest Common Denominator" problem. If we treat Postgres like Mongo, we lose complex `JOINs` and strict foreign keys. If we treat Mongo like Postgres, we suffer from expensive `$lookup` operations. Building an Abstract Syntax Tree (AST) translator that perfectly handles both paradigms on Day 1 is an extreme technical risk that stalls development.

### The Evolutionary Hybrid Approach (Our Implementation Pivot)
To unblock development while preserving the agnostic vision (and satisfying the ft_transcendence schema requirements), we adopt a phased approach:

**Phase 1: MongoDB Default Engine (The MVP)**
We use MongoDB for *both* the Control Plane and the Data Plane initially.
* By doing this, the "translation" layer is minimal. Our backend validates the generic JSON request and pushes it directly into the tenant's MongoDB collection.
* We leverage MongoDB's native `JSON Schema Validation` and `$lookup` stages to simulate relational integrity where needed.
* *Advantage:* High development speed. The system becomes functional in weeks, not months.

**Phase 2: The "Phantom Adapter" Strategy (The transcendence Shield)**
Even though we only use MongoDB initially, we strictly enforce the `IDatabaseDriver` interface. The system *believes* it is using an agnostic adapter. 

~~~mermaid
classDiagram
    class DynamicService {
        +executeAST(query: ASTQuery)
    }
    class IDatabaseDriver {
        <<interface>>
        +execute(query: ASTQuery)
    }
    class MongoAdapter {
        +execute(query: ASTQuery)
        -translateToMongoQueries()
    }
    class PostgresAdapter {
        +execute(query: ASTQuery)
        -translateToKnexSQL()
    }
    DynamicService --> IDatabaseDriver : depends on
    IDatabaseDriver <|-- MongoAdapter : Phase 1 (MVP)
    IDatabaseDriver <|-- PostgresAdapter : Phase 2 (ft_transcendence Defense)
~~~

~~~typescript
export interface ASTQuery {
  collection: string;
  where?: Record<string, any>;
  include?: string[];
}

export interface IDatabaseDriver {
  execute(query: ASTQuery): Promise<any>;
}
~~~
This guarantees that for our final evaluation, we can implement the `src/engines/sql/` PostgreSQL adapter, providing the "well-defined relations" requested by the subject, without rewriting the core business logic.

**Phase 3 (Future): Auto-Provisioning and Intelligent Routing**
Once the SQL driver is mature, we delegate the database engine decision to the BaaS itself. By analyzing the schema uploaded by the Tenant, the system will decide to provision a PostgreSQL database (high relationality) or MongoDB (deeply nested documents), without human intervention.

---

## 5. Key Concepts & Architecture

### Metadata-Driven Architecture
Most backends are static. **Our backend has zero knowledge of any user's data model at build time.** Instead of hardcoded ORM models, users define their data model as JSON metadata (The "Master Document").

#### 📄 Example: The "Master Document" (The Tenant's DNA)
~~~json
{
  "_id": "64a7b...89c",
  "tenantId": "ws_123",
  "status": "active",
  "database": {
    "engine": "mongodb",
    "uri": "mongodb://user:pass@db.example.com:27017/tenant_db"
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
~~~

#### 💻 Example: Control Plane Implementation (Mongoose)
~~~typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class TenantMetadata extends Document {
  @Prop({ required: true, unique: true, index: true })
  tenantId: string;

  @Prop({ required: true })
  status: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  database: { engine: 'postgresql' | 'mongodb' | 'mysql'; uri: string };

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  schema: Record<string, any>;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  hooks: Record<string, any>;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  permissions: Record<string, any>;

  @Prop({ default: 1 })
  version: number;
}
export const TenantMetadataSchema = SchemaFactory.createForClass(TenantMetadata);
~~~

### Multi-Tenant Isolation Strategy
To securely serve unbounded tenant diversity, isolation is enforced at three distinct layers:

~~~mermaid
graph TD
    Req[Incoming Request] --> Interceptor[Tenant Interceptor]
    Interceptor --> |"tenant_id: ws_123"| Cache[(Redis Namespace: <br/> tenant:ws_123)]
    
    Cache --> Runtime[Data Plane Runtime]
    
    subgraph Compute Isolation
        Runtime --> V8[isolated-vm Sandbox <br/> Strict CPU/RAM limits]
    end
    
    subgraph Data Isolation
        Runtime --> DB1[(Shared MongoDB <br/> Tenant Scoped Collections)]
        Runtime --> DB2[(Dedicated PostgreSQL <br/> Enterprise Tenant)]
    end
~~~

1. **Data Isolation Strategy:** A hybrid model. Small tenants use a Shared DB with tenant-scoped constraints. Enterprise tenants get a dedicated database.
2. **Compute Isolation:** Strict resource quotas and the use of sandboxed environments (`isolated-vm`) for custom user code.
3. **Cache Isolation:** Every cache key in Redis is strictly namespaced.

---

## 6. Technology Stack

To support the **Evolutionary Hybrid Approach**, our stack is divided into immediate MVP technologies and Phase 2 expansion tools.

| Layer | Technology | Why it's the right choice |
|-------|------------|---------------------------|
| **Framework** | NestJS | Its Dependency Injection allows us to dynamically inject the correct Database Adapter per request. |
| **System DB** | MongoDB (Mongoose) | Perfect for the Control Plane. Schemas (metadata) are inherently dynamic, nested JSON objects. |
| **Data Plane (Phase 1)** | Mongo Node Driver | Acts as our MVP Data Plane engine. Bypasses the need for complex AST-to-SQL translation on Day 1, allowing rapid development. |
| **Data Plane (Phase 2)** | Knex.js (PostgreSQL) | **The ft_transcendence Shield.** A dynamic query builder to construct SQL queries at runtime, fulfilling the strict "well-defined relations" requirement for final evaluation. |
| **Validation** | Zod | Compiles validation schemas directly from stored JSON metadata at runtime, protecting the Data Plane. |
| **Sandbox** | isolated-vm | Safely executes user-defined JavaScript hooks in secure V8 isolates with strict memory boundaries. |
| **Cache & Jobs** | Redis + BullMQ | Tenant-aware caching (crucial for dynamic metadata) and async task queues for billing events and background jobs. |

---

## 7. Request Flow & Orchestration (The Phantom Adapter in Action)

How do these technologies connect dynamically? Let's trace the lifecycle of a `POST /api/ws_123/books` request, highlighting the adapter abstraction:

1.  **Intercept & Context:** `TenantInterceptor` reads the `ws_123` ID. It fetches the "Master Document" from the Redis cache (or MongoDB System DB if missing).
2.  **Validation (Zod):** The `ValidationEngine` compiles the `books` schema from the Master Document and strictly validates the incoming JSON payload.
3.  **Adapter Injection (The Switch):** NestJS reads the tenant's `database.engine` preference. It dynamically instantiates the class implementing `IDatabaseDriver` (e.g., `MongoAdapter` for Phase 1, or `PostgresAdapter` for Phase 2).
4.  **Query Execution:** The `DynamicService` remains completely blind to the underlying database. It simply calls `this.db.create('books', validatedData)`. The injected adapter handles the native execution.
5.  **Hook Execution:** If defined in the metadata, `HookRuntime` spins up a secure V8 isolate, injects the new record, and executes the tenant's custom JS functions.

~~~mermaid
sequenceDiagram
  participant T as Tenant
  participant API as NestJS (API)
  participant Config as Metadata (Redis/Mongo)
  participant Adapt as IDatabaseDriver
  participant DB as Tenant Database
  participant H as Hooks (V8)

  T->>API: POST /api/ws_123/books
  activate API

  Note over API: 1. Context & Validation
  API->>Config: Get schema & DB config
  Config-->>API: Master Document
  API->>API: Validate payload (Zod)

  Note over API, Adapt: 2. Adapter Pattern
  API->>Adapt: execute({ action: 'create', ... })
  
  Note over Adapt, DB: 3. Execution (Mongo or PG)
  Adapt->>DB: Native Insert (insertOne / INSERT)
  DB-->>Adapt: Register created
  Adapt-->>API: Normalized Result

  opt Defined Hook (ej. afterCreate)
    Note over API: 4. Extensibility
    API->>H: Execute JS in isolated-vm
    H-->>API: Processed result
  end

  API-->>T: 200 OK + JSON
  deactivate API
~~~

---

## 8. Modular Directory Structure (Domain-Driven Design)

To maintain sanity, the codebase enforces strict boundaries. Controllers know nothing about SQL or NoSQL; they only speak to the `IDatabaseDriver` interface.

~~~plaintext
src/
├── main.ts                     # Application entry point
├── app.module.ts               # Root module assembling the App Factory
│
├── common/                     # Shared tools (Business-agnostic)
│   ├── interceptors/           # e.g., TenantInterceptor
│   ├── interfaces/             # IDatabaseDriver and ASTQuery contracts
│
├── modules/
│   ├── control-plane/          # GOVERNANCE (Tenant lifecycle, Metadata schemas)
│   ├── data-plane/             # EXECUTION (Dynamic API, Zod Validation)
│   ├── engines/                # ADAPTERS (The Translation Layer)
│   │   ├── core/               # DatabaseProvider Factory
│   │   ├── nosql/              # MongoAdapter (Phase 1 MVP)
│   │   └── sql/                # PostgresAdapter/Knex (Phase 2 Shield)
│   │
│   └── runtime/                # CUSTOM LOGIC (Hooks/V8, BullMQ Jobs)
│
└── infrastructure/             # INTERNAL SERVICES (Redis Cache, System-DB Mongo)
~~~

---

## 9. System Maturity Stages (Action Plan)

Building an App Factory requires pragmatic steps. We cannot build the SQL translator, the V8 Sandbox, and the Billing Engine simultaneously. 

### Stage 1: Logical Multi-Tenancy & Governance
* Implement `infrastructure/system-db` (MongoDB) to store the `TenantMetadata` JSON.
* Build the `TenantInterceptor` to resolve tenant context from HTTP requests.
* Set up Redis for metadata caching to prevent System DB bottlenecking.

### Stage 2: The Phantom Adapter & NoSQL Data Plane (MVP)
* Define the generic `IDatabaseDriver` interface.
* Implement the `MongoAdapter` as the default engine.
* Create the `DynamicController` capable of routing basic CRUD operations via the interface.
* *Milestone:* The BaaS can create/read dynamic entities using pure MongoDB.

### Stage 3: Dynamic Security (Validation)
* Integrate **Zod** in the `data-plane/validation` module.
* Parse the JSON schema from the Master Document and enforce it on every incoming `POST/PATCH` request.

### Stage 4: The PostgreSQL Shield (ft_transcendence Defense)
* Implement the `PostgresAdapter` in `src/engines/sql/` using **Knex.js**.
* Write the AST-to-SQL translation logic.
* *Milestone:* We can now officially present a strict Entity-Relationship (ER) diagram for Enterprise tenants, fully satisfying the 42 evaluation constraints.

### Stage 5: Compute Isolation (Hooks)
* Integrate `isolated-vm`.
* Build the `HookRuntime` to securely execute the JavaScript strings stored in the metadata without crashing the Node.js event loop.
* Enforce strict CPU and memory timeouts for the V8 isolates.

### Stage 6: Enterprise API Gateway & Billing
* Build a multi-tenant Gateway (Dynamic CORS, Rate Limiting per tenant).
* Refactor the Data Plane to emit asynchronous **Usage Events** to BullMQ for the Control Plane's Billing Aggregator.

---

## 10. Research & Validation: The Power of Metadata

According to industry research (e.g., [Building a Metadata-Driven Data Architecture](https://talent500.com/blog/building-a-metadata-driven-data-architecture/)), metadata acts as the central "compass" transforming raw data into governable assets.

1. **Metadata Repositories = Our System DB (MongoDB):** The single source of truth storing the `TenantMetadata`.
2. **Technical & Business Metadata = The Schema & Permissions:** Our Master Document explicitly handles both via the `"schema"` and `"permissions"` properties.
3. **Data Catalogs = Our Frontend Discovery API:** The `/discovery` endpoint reads Control Plane metadata enabling automatic UI generation without hardcoded API routes.
4. **Governance = Hooks & Jobs:** Our `isolated-vm` Hooks and telemetry events track when records are manipulated, enforcing business rules globally.

---

## 11. Enterprise SaaS Capabilities: Scalability & Evolution

* **Dynamic CORS & WAF:** Rules are stored in the Control Plane's Master Document and applied per request.
* **Tenant-Scoped Metrics:** Tracking the **95th percentile (p95)** latency per tenant prevents one bad query from triggering global alarms.
* **Schema Evolution & Metadata Versioning:** Schema changes are instantaneous and reversible. Adding a column generates a new Master Document with `version: 2`. Rollbacks are just a pointer flip in the Control Plane.
* **Usage Metering (Event-Driven):** Calculating bills inside the API destroys performance. The Data Plane pushes events asynchronously to a queue (BullMQ), enabling the Control Plane to process billing without impacting request latency.

~~~mermaid
sequenceDiagram
    participant Client
    participant DP as Data Plane (NestJS)
    participant Q as BullMQ (Redis)
    participant CP as Control Plane (Billing)

    Client->>DP: GET /api/ws_123/books
    activate DP
    DP->>DP: Execute Query (15ms)
    DP-->>Client: 200 OK (Data)
    DP-)Q: Emit Event {type: 'read', tenant: 'ws_123'}
    deactivate DP
    
    Note over Q,CP: Asynchronous Background Process
    Q-->>CP: Consume Event
    activate CP
    CP->>CP: Update Tenant Usage Metrics
    CP->>CP: Check Tier Limits
    deactivate CP
~~~
