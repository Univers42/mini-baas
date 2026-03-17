# MongoDB Schema Design Patterns applied to mini-baas

> **Purpose of this document:** To justify the choice of MongoDB as the primary database for the Control Plane in `mini-baas`, demonstrating how its schema design patterns naturally solve the architectural challenges of a dynamic, multi-tenant Backend-as-a-Service.

---

## 📋 Navigation Index

| # | Section | Key Concept |
|---|---------|-------------|
| [1](#1-introduction) | **Introduction** | The problem MongoDB solves for mini-baas |
| [2](#2-the-polymorphic-pattern--the-foundation-of-everything) | **Polymorphic Pattern** | Multiple tenants, a single collection |
| [3](#3-the-computed-pattern--read-fast-compute-once) | **Computed Pattern** | Pre-computing billing for O(1) reads |
| [4](#4-the-approximation-pattern--performance-over-absolute-precision) | **Approximation Pattern** | Reducing metric writes by 99% |
| [5](#5-the-schema-versioning-pattern--evolve-without-downtime) | **Schema Versioning Pattern** | Evolving Master Documents without downtime |
| [6](#6-schema-validation--flexibility-with-control) | **Schema Validation** | Integrity without sacrificing flexibility |
| [7](#7-summary-and-conclusion-why-mongodb-is-the-right-choice-for-mini-baas) | **Summary & Conclusion** | Full pattern synergy in mini-baas |
| [8](#8-bibliography) | **Bibliography** | Sources and original links |

---

## 1. Introduction

`mini-baas` is an **App Factory**: a dynamic engine capable of provisioning and serving multiple applications (Tenants) from a single shared infrastructure, without a single line of hardcoded schema, controller, or model. Its architecture is divided into two distinct planes:

- **Control Plane:** stores the `TenantMetadata` — the "Master Documents" that define each tenant's schema, hooks, and permissions.
- **Data Plane:** stateless runtime that executes data operations according to the Control Plane's instructions.

The central challenge is that the Control Plane must manage documents that are **radically different from one another** (each tenant has their own data model), **evolve without downtime** (tenants modify their schemas in production), and **scale** without degrading under high concurrency.

No relational database solves this triangle without severe trade-offs. MongoDB, on the other hand, has native design patterns for each of these problems.

```mermaid
graph TD
    subgraph Challenge["🎯 The mini-baas impossible triangle"]
        A["Heterogeneous documents
		(every tenant is different)"]
        B["Evolution without downtime
		(changes in production)"]
        C["Scalability
		(thousands of tenants)"]
    end

    subgraph Solution["✅ MongoDB solves it with native patterns"]
        D["Polymorphic Pattern"]
        E["Schema Versioning
		+ Schema Validation"]
        F["Computed Pattern
		+ Approximation"]
    end

    A --> D
    B --> E
    C --> F

    style Challenge fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    style Solution fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px,color:#000
```

> **Reading this diagram:** Each corner of the triangle represents a core architectural challenge that mini-baas must solve simultaneously. The arrows show which MongoDB pattern directly addresses each challenge. The fact that all three can be addressed with a single database — without compromises — is precisely why MongoDB was chosen over a relational alternative.

The following sections explore the five most relevant patterns, all referenced to the concrete data model of `mini-baas`.

---

## 2. The Polymorphic Pattern — The Foundation of Everything

> 🔗 *Quick navigation: [↑ Index](#-navigation-index) · [→ Computed Pattern](#3-the-computed-pattern--read-fast-compute-once)*

### Definition

The Polymorphic Pattern consists of storing documents with **similar but not identical structures** within a **single collection**. Instead of creating one collection per "type" of entity, we group all related documents in one place and add a discriminator field that identifies the type.

> The key insight: documents with **more similarities than differences** coexist in the same collection, making it possible to query all of them with a single operation.

### Pattern Diagram

```mermaid
graph LR
    subgraph Without["❌ Without Polymorphic Pattern (SQL / multiple collections)"]
        T1[(tenants_bookstore)]
        T2[(tenants_tripmanager)]
        T3[(tenants_ecommerce)]
        Q1[Query with 4× JOINs]
        T1 --> Q1
        T2 --> Q1
        T3 --> Q1
    end

    subgraph With["✅ With Polymorphic Pattern (MongoDB)"]
        COL[(collection: tenants)]
        D1[ws_bookstore\nengine: postgresql]
        D2[ws_tripmanager\nengine: mongodb]
        D3[ws_ecommerce\nengine: mysql]
        Q2["db.tenants.findOne({ tenantId })"]
        D1 --> COL
        D2 --> COL
        D3 --> COL
        COL --> Q2
    end

    style Without fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#000
    style With fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px,color:#000
```

> **Reading this diagram:** The left side shows what a SQL approach would look like — separate tables for every tenant type, requiring multiple JOINs every time the Data Plane needs to resolve a tenant context. The right side shows the MongoDB approach: all tenants in a single collection, regardless of how different their schemas are. Every node pointing into `collection: tenants` represents a completely different business model, yet they are all fetched with the exact same query.

### Example applied to mini-baas

Two tenants with completely different business models — a bookstore and a trip management app — share common fields (`tenantId`, `status`, `version`) but have entirely different `schema`, `hooks`, and `permissions` sections. Both documents coexist in the same `tenants` collection.

```javascript
// Tenant A: Bookstore (Data Plane → PostgreSQL)
{
  "_id": "64a7b...01",
  "tenantId": "ws_bookstore",
  "status": "active",
  "version": 1,
  "database": {
    "engine": "postgresql",
    "uri": "postgres://user:pass@db.bookstore.com:5432/tenant_db"
  },
  "schema": {
    "books": {
      "fields": {
        "title":  { "type": "string",  "required": true },
        "isbn":   { "type": "string",  "required": true },
        "price":  { "type": "number",  "default": 0 }
      }
    }
  },
  "hooks": {
    "books": {
      "beforeCreate": "function(data) { if(data.price < 0) throw new Error('Invalid price'); return data; }"
    }
  },
  "permissions": {
    "books": { "read": ["public"], "create": ["admin"] }
  }
}

// Tenant B: Trip management app (Data Plane → their own MongoDB)
{
  "_id": "64a7b...02",
  "tenantId": "ws_tripmanager",
  "status": "active",
  "version": 1,
  "database": {
    "engine": "mongodb",
    "uri": "mongodb+srv://user:pass@cluster.trip.mongodb.net/tenant_db"
  },
  "schema": {
    "trips": {
      "fields": {
        "destination": { "type": "string", "required": true },
        "students":    { "type": "array",  "items": { "type": "string" } },
        "budget":      { "type": "number" }
      }
    },
    "expenses": {
      "fields": {
        "tripId":    { "type": "string", "required": true },
        "studentId": { "type": "string", "required": true },
        "amount":    { "type": "number", "required": true }
      }
    }
  },
  "hooks": {},
  "permissions": {
    "trips":    { "read": ["admin", "student"], "create": ["admin"] },
    "expenses": { "read": ["admin"],            "create": ["admin", "student"] }
  }
}
```

A **single query** retrieves the metadata for any tenant:

```javascript
// One query serves all tenants in the system
db.tenants.findOne({ tenantId: "ws_bookstore" });
db.tenants.findOne({ tenantId: "ws_tripmanager" });

// Or find all active tenants using a specific engine
db.tenants.find({ status: "active", "database.engine": "postgresql" });
```

**Why not SQL here?** In PostgreSQL we would need a base `tenants` table plus additional tables for `tenant_schemas`, `tenant_fields`, `tenant_hooks`, and `tenant_permissions`, with JOINs on every single request. In MongoDB, the complete document — the entire Master Document — is loaded in a single operation, eliminating latency and structural complexity.

---

## 3. The Computed Pattern — Read Fast, Compute Once

> 🔗 *Quick navigation: [↑ Index](#-navigation-index) · [← Polymorphic](#2-the-polymorphic-pattern--the-foundation-of-everything) · [→ Approximation](#4-the-approximation-pattern--performance-over-absolute-precision)*

### Definition

The Computed Pattern **pre-calculates values** that would otherwise require expensive aggregations on every read. The cost of computation is paid **once at write time**; all subsequent reads are instantaneous.

> Core principle: *"Pay the cost once when writing, rather than paying it every time when reading."*

### Pattern Diagram

```mermaid
sequenceDiagram
    participant Dashboard as 🖥️ Tenant Dashboard
    participant DataPlane as ⚙️ Data Plane (NestJS)
    participant MongoDB as 🍃 MongoDB (Control Plane)
    participant BullMQ as 📬 BullMQ (Queue)
    participant Aggregator as 🧮 BillingAggregator

    Note over Dashboard,Aggregator: ❌ WITHOUT Computed Pattern — every read aggregates millions of events
    Dashboard->>DataPlane: GET /billing/summary
    DataPlane->>MongoDB: aggregate(usageEvents) ← slow, expensive
    MongoDB-->>DataPlane: result after scanning millions of docs
    DataPlane-->>Dashboard: response in ~2000ms ⚠️

    Note over Dashboard,Aggregator: ✅ WITH Computed Pattern — instant read
    BullMQ->>Aggregator: hourly job (background)
    Aggregator->>MongoDB: aggregate(usageEvents) ← costly, but only 1×/hour
    Aggregator->>MongoDB: updateOne({ billing.computed }) ← stores result
    Dashboard->>DataPlane: GET /billing/summary
    DataPlane->>MongoDB: findOne({ tenantId }, { billing.computed }) ← O(1)
    MongoDB-->>DataPlane: pre-calculated field
    DataPlane-->>Dashboard: response in ~15ms ✅
```

> **Reading this diagram:** The top half shows the naive approach — each dashboard request triggers a full aggregation scan of potentially millions of `UsageEvents`. The bottom half shows how the Computed Pattern inverts this: the expensive aggregation runs once per hour in the background (via BullMQ), and the result is stored directly inside the `TenantMetadata` document. Dashboard reads become a simple `findOne`, dropping response time from ~2000ms to ~15ms regardless of how much historical data exists.

### Example applied to mini-baas — Billing System

The Billing Engine emits asynchronous `UsageEvents` that are consumed by the `BillingAggregator`. Instead of recalculating a tenant's total consumption on every dashboard request, we store the pre-computed totals inside the `TenantMetadata` itself.

```javascript
// TenantMetadata enriched with pre-computed billing fields
{
  "tenantId": "ws_bookstore",
  "status": "active",
  "version": 2,

  // ... schema, hooks, permissions ...

  // Pre-computed fields — updated by the BillingAggregator
  "billing": {
    "currentPeriod": "2026-03",
    "computed": {
      "totalDatabaseReads":   15420,
      "totalDatabaseWrites":  3210,
      "totalHookExecutions":  890,
      "totalStorageMB":       245.7,
      "estimatedCostUSD":     12.45,
      "lastCalculatedAt":     "2026-03-09T02:00:00Z"  // Hourly computation
    }
  }
}
```

The `BillingAggregator` runs on a schedule (via BullMQ) and updates these fields using an aggregation pipeline:

```javascript
// Step 1: Aggregate all UsageEvents for the period for a given tenant
const billingPipeline = [
  {
    $match: {
      tenantId: "ws_bookstore",
      timestamp: { $gte: new Date("2026-03-01"), $lt: new Date("2026-04-01") }
    }
  },
  {
    $group: {
      _id: "$tenantId",
      totalDatabaseReads:  { $sum: { $cond: [{ $eq: ["$eventType", "database_read"]  }, "$unitsConsumed", 0] } },
      totalDatabaseWrites: { $sum: { $cond: [{ $eq: ["$eventType", "database_write"] }, "$unitsConsumed", 0] } },
      totalHookExecutions: { $sum: { $cond: [{ $eq: ["$eventType", "hook_execution"] }, 1, 0] } }
    }
  }
];

const [result] = await db.usageEvents.aggregate(billingPipeline).toArray();

// Step 2: Update the computed field in the Master Document
await db.tenants.updateOne(
  { tenantId: "ws_bookstore" },
  {
    $set: {
      "billing.computed.totalDatabaseReads":  result.totalDatabaseReads,
      "billing.computed.totalDatabaseWrites": result.totalDatabaseWrites,
      "billing.computed.totalHookExecutions": result.totalHookExecutions,
      "billing.computed.estimatedCostUSD":    calculateCost(result),
      "billing.computed.lastCalculatedAt":    new Date()
    }
  }
);

// Step 3: Dashboard read — O(1), no aggregations needed
const tenant = await db.tenants.findOne(
  { tenantId: "ws_bookstore" },
  { projection: { "billing.computed": 1 } }
);
// → Instant response with all pre-calculated totals
```

**Direct impact on mini-baas:** The billing dashboard for each tenant loads in milliseconds, regardless of whether there are millions of historical `UsageEvents`. The expensive aggregation happens once per hour in the background — not on every user request.

---

## 4. The Approximation Pattern — Performance Over Absolute Precision

> 🔗 *Quick navigation: [↑ Index](#-navigation-index) · [← Computed](#3-the-computed-pattern--read-fast-compute-once) · [→ Schema Versioning](#5-the-schema-versioning-pattern--evolve-without-downtime)*

### Definition

The Approximation Pattern accepts statistically valid values instead of exact figures for **high-volume, low-criticality metrics**, reducing write operations by up to 99% and freeing up resources for truly critical operations.

> *"Good enough is often good enough."*

### Pattern Diagram

```mermaid
graph TD
    subgraph Requests["⚡ 10,000 requests/minute (active tenant)"]
        R1[Request 1]
        R2[Request 2]
        RN[Request N...]
    end

    subgraph Without["❌ Without Approximation"]
        W1[(MongoDB
		10,000 writes/min)]
    end

    subgraph With["✅ With Approximation"]
        Redis["Redis
		in-memory buffer"]
        Threshold{"Threshold
		reached?
		(1,000 requests)"}
        W2[(MongoDB
		10 writes/min)]
    end

    R1 --> Without
    R2 --> Without
    RN --> Without

    R1 --> Redis
    R2 --> Redis
    RN --> Redis
    Redis --> Threshold
    Threshold -->|"Yes → flush
	(1 write = 1,000 requests)"| W2
    Threshold -->|No → accumulate| Redis

    style Without fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#000
    style With fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px,color:#000
```

> **Reading this diagram:** Both sides receive the same 10,000 requests per minute. Without the pattern, every single request triggers a MongoDB write — the database becomes the bottleneck. With the pattern, each request increments a counter in Redis (an in-memory operation, essentially free). Only when that counter crosses the threshold of 1,000 does a single write go to MongoDB. The result is a 99.9% reduction in write operations, with the counter in MongoDB staying statistically accurate for all practical purposes (trend analysis, dashboards, reporting).

### Example applied to mini-baas — Real-time Usage Metrics

`mini-baas` exposes a real-time metrics dashboard to each tenant: total requests served, cache hits, average response time. These figures are updated with every request to the Data Plane — potentially thousands per second for an active tenant. Writing to MongoDB on every individual request would be prohibitive.

```javascript
// Metrics document structure with approximation
{
  "tenantId": "ws_bookstore",
  "metrics": {

    // ✅ CRITICAL — always exact (affects real billing)
    "billing": {
      "exactWrites": 3210,
      "exactReads":  15420
    },

    // ✅ APPROXIMATE — high volume, we only need trends
    "realtime": {
      "totalRequests": {
        "approximate": 1450000,
        "updateThreshold": 1000,    // Only write to DB every 1,000 requests
        "lastUpdatedAt": "2026-03-09T10:00:00Z"
      },
      "cacheHits": {
        "approximate": 980000,
        "updateThreshold": 500
      },
      "avgResponseMs": {
        "approximate": 42,
        "updateThreshold": 200      // Update every 200 requests
      }
    }
  }
}
```

The approximation logic lives inside the `TenantInterceptor` in NestJS, which accumulates counters in Redis before flushing to MongoDB:

```javascript
// TenantInterceptor — approximation logic using Redis as a buffer
async function trackRequest(tenantId: string, responseMs: number): Promise<void> {
  const redisKey = `tenant:${tenantId}:pending_metrics`;

  // Accumulate in Redis (ultra-fast, no disk I/O)
  const pending = await redis.incr(`${redisKey}:requests`);
  await redis.incrbyfloat(`${redisKey}:totalMs`, responseMs);

  // Only flush to MongoDB when the threshold is crossed (every 1,000 requests)
  if (pending >= 1000) {
    const totalMs = await redis.getdel(`${redisKey}:totalMs`);
    await redis.del(`${redisKey}:requests`);

    // One single MongoDB write represents 1,000 real requests
    await db.tenants.updateOne(
      { tenantId },
      {
        $inc: { "metrics.realtime.totalRequests.approximate": 1000 },
        $set: {
          "metrics.realtime.avgResponseMs.approximate": Math.round(totalMs / 1000),
          "metrics.realtime.totalRequests.lastUpdatedAt": new Date()
        }
      }
    );
  }
}
```

**Direct impact on mini-baas:** A tenant receiving 10,000 requests/minute would generate 10,000 MongoDB writes/minute without this pattern. With a threshold of 1,000, it generates only 10 writes/minute — a **99.9% reduction**. MongoDB can dedicate those resources to truly critical operations: tenant context resolution, schema validation, and hook execution.

---

## 5. The Schema Versioning Pattern — Evolve Without Downtime

> 🔗 *Quick navigation: [↑ Index](#-navigation-index) · [← Approximation](#4-the-approximation-pattern--performance-over-absolute-precision) · [→ Schema Validation](#6-schema-validation--flexibility-with-control)*

### Definition

The Schema Versioning Pattern allows **documents with different structural versions to coexist in the same collection**, using a `version` field as a discriminator. Migrations are gradual, optional, and never require stopping the application.

> *"The only constant is change. This pattern turns that into an advantage rather than a risk."*

### Pattern Diagram

```mermaid
stateDiagram
    direction LR

    [*] --> V1 : Tenant created
    V1 --> V2 : Tenant adds "expenses"
    V2 --> V3 : Tenant adds pre-computed billing fields

    state V1 {
        s1: schema = trips
        s2: hooks = none
        s3: version = implicit 1
    }

    state V2 {
        s4: schema = trips, expenses
        s5: hooks = expenses.beforeCreate
        s6: version = 2
    }

    state V3 {
        s7: schema = trips, expenses
        s8: hooks = expenses.beforeCreate
        s9: billing.computed = totalReads, ...
        s10: version = 3
    }

    note right of V1
        V1 documents keep working
        while V2 and V3 are already
        live in production
    end note

    note right of V2
        Instant rollback:
        just flip the active
        version pointer
    end note
```

> **Reading this diagram:** Each box represents a version of the same tenant's Master Document. The critical insight is that these three versions are **not sequential replacements** — they coexist simultaneously in the `tenants` collection. The Data Plane's `SchemaVersionManager` reads the `version` field (or assumes v1 if absent) and applies the correct logic path. This means a tenant can be upgraded to v2 while another tenant is still on v1, with zero interference between them. If a v2 change breaks something, rolling back is as simple as changing `version: 2` back to `version: 1` — no ALTER TABLE, no migration scripts, no downtime.

### Example applied to mini-baas — Evolving the Master Document

Tenants in `mini-baas` frequently modify their schemas in production: adding collections, changing field types, incorporating new permission rules. The Master Document must evolve without interrupting the service.

```javascript
// Version 1 — Initial Master Document (no version field, implicitly v1)
{
  "tenantId": "ws_tripmanager",
  "status": "active",
  "database": { "engine": "postgresql", "uri": "postgres://..." },
  "schema": {
    "trips": {
      "fields": {
        "destination": { "type": "string", "required": true },
        "budget":      { "type": "number" }
      }
    }
  },
  "hooks": {},
  "permissions": { "trips": { "read": ["admin"] } }
}

// Version 2 — Adds expense management and granular role-based permissions
{
  "tenantId": "ws_tripmanager",
  "status": "active",
  "version": 2,                      // ← Explicit version field from v2 onward
  "database": { "engine": "postgresql", "uri": "postgres://..." },
  "schema": {
    "trips": { "fields": { "destination": { "type": "string", "required": true }, "budget": { "type": "number" } } },
    "expenses": {                    // ← New collection added
      "fields": {
        "tripId":    { "type": "string", "required": true },
        "studentId": { "type": "string", "required": true },
        "amount":    { "type": "number", "required": true },
        "category":  { "type": "string", "enum": ["food", "transport", "accommodation"] }
      }
    }
  },
  "hooks": {
    "expenses": {
      "beforeCreate": "function(data) { if(data.amount <= 0) throw new Error('Invalid amount'); return data; }"
    }
  },
  "permissions": {
    "trips":    { "read": ["admin", "student"], "create": ["admin"] },
    "expenses": { "read": ["admin"],            "create": ["admin", "student"] }
  }
}
```

The `SchemaVersionManager` in the Data Plane handles multiple versions at runtime:

```javascript
// SchemaVersionManager — handles all tenants regardless of their active version
class SchemaVersionManager {
  private migrations = new Map<string, Function>();

  register(from: number, to: number, fn: Function) {
    this.migrations.set(`${from}->${to}`, fn);
  }

  getHandler(document: TenantMetadata) {
    const version = document.version ?? 1;

    switch (version) {
      case 1:
        // Schema without "expenses" collection or hooks
        return {
          allowedCollections: Object.keys(document.schema),
          hasHooks: false,
          getPermissions: (col: string) => document.permissions[col] ?? { read: ["admin"] }
        };
      case 2:
        // Full schema with hooks and granular permissions
        return {
          allowedCollections: Object.keys(document.schema),
          hasHooks: Object.keys(document.hooks).length > 0,
          getPermissions: (col: string) => document.permissions[col] ?? { read: ["admin"] }
        };
      default:
        throw new Error(`Unknown schema version: ${version}`);
    }
  }

  // Lazy migration — tenant is migrated in the background when accessed
  async migrateIfNeeded(tenantId: string, targetVersion: number): Promise<void> {
    const doc = await db.tenants.findOne({ tenantId });
    const currentVersion = doc.version ?? 1;

    if (currentVersion >= targetVersion) return;

    // Apply incremental migrations
    let migratedDoc = { ...doc };
    for (let v = currentVersion; v < targetVersion; v++) {
      const migrationFn = this.migrations.get(`${v}->${v + 1}`);
      if (migrationFn) {
        migratedDoc = migrationFn(migratedDoc);
        migratedDoc.version = v + 1;
      }
    }

    await db.tenants.updateOne({ tenantId }, { $set: migratedDoc });
  }
}

// Registering the v1 → v2 migration
versionManager.register(1, 2, (doc) => ({
  ...doc,
  schema: {
    ...doc.schema,
    expenses: {
      fields: {
        tripId:    { type: "string",  required: true },
        studentId: { type: "string",  required: true },
        amount:    { type: "number",  required: true }
      }
    }
  },
  hooks: doc.hooks ?? {}
}));
```

**Direct impact on mini-baas:** A tenant can upgrade their schema from v1 to v2 without affecting any other tenant and without restarting the server. Rollback is instant: the Control Plane simply points back to the previous versioned document.

---

## 6. Schema Validation — Flexibility With Control

> 🔗 *Quick navigation: [↑ Index](#-navigation-index) · [← Schema Versioning](#5-the-schema-versioning-pattern--evolve-without-downtime) · [→ Summary](#7-summary-and-conclusion-why-mongodb-is-the-right-choice-for-mini-baas)*

### Definition

Schema Validation in MongoDB allows you to define **integrity rules per collection** without sacrificing flexibility. Strict validations can be applied to new documents while legacy documents remain valid, combining multiple schema shapes with `oneOf` to accommodate different versions.

> MongoDB is not "schemaless" — it is *"schema when you need it, with the granularity you choose."*

### Pattern Diagram

```mermaid
flowchart TD
    INSERT["📥 Insert / Update into
	tenants collection"]

    INSERT --> VALIDATOR{"🔍 MongoDB
	Schema Validator"}

    VALIDATOR --> ONEOF{"oneOf"}

    ONEOF --> V1CHECK["Base Rule (implicit v1)
	- tenantId matches ws_* pattern
	- status within enum
	- database.engine within enum"]
    ONEOF --> V2CHECK["v2+ Rule
	- Base Rule +
	- billing.computed valid structure
	- estimatedCostUSD >= 0"]

    V1CHECK --> PASS1{Valid?}
    V2CHECK --> PASS2{Valid?}

    PASS1 -->|Yes| OK["✅ Document accepted
	proceeds to Data Plane"]
    PASS2 -->|Yes| OK
    PASS1 -->|No| FAIL["❌ Error: document rejected
	never reaches the Data Plane"]
    PASS2 -->|No| FAIL

    style INSERT fill:#e3f2fd,stroke:#1565c0,color:#000
    style OK fill:#e8f5e9,stroke:#1b5e20,color:#000
    style FAIL fill:#ffebee,stroke:#c62828,color:#000
    style VALIDATOR fill:#fff9c4,stroke:#f57f17,color:#000
```

> **Reading this diagram:** Every write operation to the `tenants` collection passes through MongoDB's built-in Schema Validator before being committed to disk. The `oneOf` operator means the document must satisfy exactly one of the two defined rules — either the implicit v1 structure (no billing fields) or the v2+ structure (with a valid `billing.computed` sub-document). If neither rule is satisfied, MongoDB rejects the document with an error before it ever touches the application layer. This is the last line of defense: a malformed Master Document cannot enter the system even if there is a bug in the application code.

### Example applied to mini-baas — Validating Master Documents

The `tenants` collection in the Control Plane must guarantee that no malformed `TenantMetadata` enters the system, regardless of the document's version.

```javascript
// Base rule: required fields common to all versions
const baseRule = {
  bsonType: "object",
  required: ["tenantId", "status", "database", "schema"],
  additionalProperties: true,   // Allow additional fields per version
  properties: {
    tenantId: {
      bsonType: "string",
      pattern: "^ws_[a-z0-9_]+$"   // Strict format: ws_<slug>
    },
    status: {
      bsonType: "string",
      enum: ["active", "suspended", "pending"]
    },
    database: {
      bsonType: "object",
      required: ["engine", "uri"],
      properties: {
        engine: {
          bsonType: "string",
          enum: ["postgresql", "mongodb", "mysql"]
        },
        uri: { bsonType: "string" }
      }
    }
  }
};

// Additional rule for v2+: pre-computed billing with correct structure
const billingRule = {
  bsonType: "object",
  properties: {
    version: { bsonType: "int", minimum: 2 },
    billing: {
      bsonType: "object",
      properties: {
        computed: {
          bsonType: "object",
          required: ["lastCalculatedAt"],
          properties: {
            estimatedCostUSD: { bsonType: "double", minimum: 0 }
          }
        }
      }
    }
  }
};

// Apply combined validation: accepts v1 (no billing) or v2+ (valid billing)
db.runCommand({
  collMod: "tenants",
  validator: {
    $jsonSchema: {
      oneOf: [
        baseRule,                           // Tenants without version field (implicit v1)
        { allOf: [baseRule, billingRule] }  // Tenants with version >= 2
      ]
    }
  },
  validationLevel: "strict",   // Applies to both inserts and updates
  validationAction: "error"    // Rejects non-compliant documents
});
```

**Direct impact on mini-baas:** The Control Plane guarantees that no corrupt `TenantMetadata` reaches the Data Plane. A validation error in MongoDB is far cheaper than a runtime failure inside `isolated-vm` or the `Adapter Factory` caused by a malformed document reaching the execution layer.

---

## 7. Summary and Conclusion: Why MongoDB Is the Right Choice for mini-baas

> 🔗 *Quick navigation: [↑ Index](#-navigation-index) · [← Schema Validation](#6-schema-validation--flexibility-with-control) · [→ Bibliography](#8-bibliography)*

### Challenge → Pattern → Impact Mapping

| mini-baas Challenge | MongoDB Pattern | Measurable Impact |
|---|---|---|
| Each tenant has a radically different `TenantMetadata` | **Polymorphic** | 1 `tenants` collection, 1 query to load any tenant |
| Billing dashboard must respond < 50ms with millions of UsageEvents | **Computed** | Pre-calculated totals hourly; O(1) reads |
| Data Plane receives thousands of requests/second | **Approximation** | 99% fewer writes for telemetry metrics |
| Tenants modify schemas in production without being able to stop the service | **Schema Versioning** | v1 and v2 coexist; instant rollback; lazy background migration |
| The `tenants` collection cannot accept malformed Master Documents | **Schema Validation** | Rejection at the database level before reaching the Data Plane |

### Why Not SQL for the Control Plane?

A relational system would require separate tables for `tenants`, `tenant_schemas`, `tenant_fields`, `tenant_hooks`, `tenant_permissions`, and `tenant_billing_computed`. Every tenant context resolution would require 4–6 JOINs. Schema evolution would require `ALTER TABLE` with potential downtime. The flexibility of the `schema` field — which can contain any arbitrary structure defined by the tenant — would be impossible to model in SQL without `TEXT` columns storing raw JSON, effectively turning SQL into a poorly implemented MongoDB.

### Full Architecture Synergy Diagram

```mermaid
graph TD
    subgraph ControlPlane["🏛️ Control Plane — MongoDB"]
        CP_COL[(collection: tenants)]

        subgraph Patterns["Active Patterns"]
            P1["🔵 Polymorphic\nAll tenants in\none collection"]
            P2["🟢 Computed\nbilling.computed\npre-calculated hourly"]
            P3["🟡 Schema Versioning\nv1, v2, v3\ncoexist safely"]
            P4["🔴 Schema Validation\noneOf: [baseRule, billingRule]\nrejection at write time"]
        end

        CP_COL --- P1
        CP_COL --- P2
        CP_COL --- P3
        CP_COL --- P4
    end

    subgraph DataPlane["⚙️ Data Plane — NestJS"]
        TI["TenantInterceptor\nResolves tenant context"]
        SVM["SchemaVersionManager\nHandles v1 / v2 / v3"]
        AF["Adapter Factory\nPostgres / MongoDB / MySQL"]
        HR["Hook Runtime\nisolated-vm"]
    end

    subgraph Infra["🔧 Infrastructure"]
        Redis["Redis\nmetrics buffer\n(Approximation Pattern)"]
        BullMQ["BullMQ\nBillingAggregator\nhourly background job"]
    end

    subgraph TenantDBs["🗄️ Tenant Data Plane DBs"]
        PG[(PostgreSQL\nws_bookstore)]
        MDB[(MongoDB\nws_tripmanager)]
    end

    CP_COL -->|"findOne(tenantId)"| TI
    TI --> SVM
    SVM --> AF
    AF --> PG
    AF --> MDB
    AF --> HR

    TI -->|"trackRequest()"| Redis
    Redis -->|"threshold reached\n(×1,000)"| CP_COL
    BullMQ -->|"aggregate(usageEvents)\nupdateOne(billing.computed)"| CP_COL

    style ControlPlane fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    style DataPlane fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px,color:#000
    style Infra fill:#fff8e1,stroke:#f57f17,stroke-width:2px,color:#000
    style TenantDBs fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px,color:#000
```

> **Reading this diagram:** This is the full picture of how all five patterns work together inside mini-baas. The blue box (Control Plane) is the heart of the system — the single MongoDB collection `tenants` with all four active patterns annotated. Every arrow shows a real data flow: the `TenantInterceptor` reads from it on every request, the `BillingAggregator` writes to it hourly, and the Redis buffer feeds approximate metrics back into it at threshold intervals. The purple box (Data Plane) is completely stateless — it has no knowledge of business logic until it reads the Master Document. The green boxes at the bottom are the actual tenant databases, which can be any engine, proving that MongoDB's role here is governance and metadata — not data storage for tenant records.

### Conclusion

MongoDB is not simply "a NoSQL database" for `mini-baas` — it is the engine that makes the project's fundamental premise possible: **a single system that transforms itself at runtime to serve any business model it has never seen before**.

The five patterns do not operate in isolation — they reinforce each other:

1. The **Polymorphic Pattern** allows all tenants to live in one collection while **Schema Validation** enforces their integrity at the database level.
2. **Schema Versioning** allows those polymorphic documents to evolve without downtime.
3. The **Computed Pattern** enriches those versioned documents with pre-calculated billing data.
4. The **Approximation Pattern** ensures that high-volume telemetry metrics do not saturate the database while business-critical data maintains exact consistency.

Together, these five patterns form a complete, self-reinforcing architecture where each layer protects and enables the others — exactly what a production-ready, multi-tenant App Factory requires.

---

## 8. Bibliography

> 🔗 *Quick navigation: [↑ Index](#-navigation-index)*

All patterns documented in this summary are based on the following original sources. Full reading of each article is strongly recommended for a deeper understanding of every concept.

### MongoDB Design Patterns — Primary Sources (MongoDB Official)

| Pattern | Author | Link |
|---------|--------|------|
| Polymorphic Pattern | Ken W. Alger | [Building With Patterns: The Polymorphic Pattern](https://www.kenwalger.com/blog/nosql/mongodb/mongodb-schema-design-patterns-polymorphic/) |
| Schema Versioning Pattern | Ken W. Alger | [Building with Patterns: The Schema Versioning Pattern](https://www.kenwalger.com/blog/nosql/mongodb/building-with-patterns-the-schema-versioning-pattern/) |
| Approximation Pattern | Ken W. Alger | [Building with Patterns: The Approximation Pattern](https://www.kenwalger.com/blog/nosql/mongodb/building-with-patterns-the-extended-reference-pattern/) |

### MongoDB Design Patterns — Community Sources

| Pattern | Author | Link |
|---------|--------|------|
| Computed + Inheritance Patterns | Tharusha Dinuja Yayanew | [How to use Inheritance, Computed and Extended Reference Patterns](https://medium.com/@tharushadinujayanew/how-to-use-inheritance-computed-and-extended-reference-patterns-to-optimize-mongodb-schemas-3962a387ef4b) |
| Computed Pattern (Applied) | MarshHawk | [The MongoDB Computed Pattern Applied](https://marshhawk.medium.com/the-mongodb-computed-pattern-applied-c48fcc333176) |
| Computed Pattern (Theory) | Shashi Prakash Gautam | [MongoDB Data Modeling Patterns — Computed Pattern](https://shweshi.medium.com/mongodb-data-modeling-patterns-computed-pattern-d9c72fdc01c5) |
| Approximation + Schema Patterns | Shanu95 | [Schema Patterns - MongoDB - Part 2](https://shanu95.medium.com/schema-patterns-mongodb-part-2-73bfabf86c9) |
| Schema Versioning + Validation | Andrew Morgan | [Using MongoDB Schema Validation With the Schema Versioning Pattern](https://medium.com/mongodb/using-mongodb-schema-validation-with-the-schema-versioning-pattern-f51ce63ff376) |
| Schema Validation | Adrienne Tacke | [Improve Data Consistency in MongoDB With Schema Validation](https://medium.com/mongodb/improve-data-consistency-in-mongodb-with-schema-validation-53e8a9844bb5) |

### mini-baas Internal Reference

| Document | Description |
|----------|-------------|
| `mini-baas Architecture & Strategy` | Project architecture document. Defines Control Plane, Data Plane, Master Document, Adapter Pattern, and the 7 system maturity stages. |

### Additional Recommended Resources

| Resource | Link |
|----------|------|
| Mongoose SchemaTypes (Mixed) | [https://mongoosejs.com/docs/schematypes.html#mixed](https://mongoosejs.com/docs/schematypes.html#mixed) |
| Metadata-Driven Data Architecture | [https://talent500.com/blog/building-a-metadata-driven-data-architecture/](https://talent500.com/blog/building-a-metadata-driven-data-architecture/) |