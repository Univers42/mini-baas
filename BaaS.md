# Planning

## Key concepts
- Tenant: In the context of backend as a service (BaaS), a tenant refers to a user or group of users that share a single instance of a software application while having their data and configurations isolated from other tenants. This architecture allows multiple tenants to utilize the same backend resources efficiently while ensuring data privacy and security.

## **Multi-Tenant Isolation Strategy**

### Common Isolation Models

- **Shared DB + Shared Schema**

   * Every tenant share the same tables.
   * Isolation per `tenant_id` in each query.
   * Cheaper, but more risk on data leakage in case of filtering logic failure. ([xappifai.com][2])

- **Shared DB + Separate Schemas**

   * Same physical database.
   * Each tenants has its own logical *schema*.
   * Strong isolation with lower costs. ([xappifai.com][2])

- **Database per Tenant**

   * Each tenant has its own database.
   * Greater isolation and security.
   * More expensive in operations and connections. ([xappifai.com][2])

---

## **Control Plane vs Data Plane (SaaS Architecture)**

### **Control Plane**

Manages:

* Tenant management (onboarding/offboarding)
* Access policies
* Global configurations
* Billing and plans
  This plane should not handle sensitive tenant data directly. ([wild.codes][4])

### **Data Plane**

Handles:

* Data requests
* CRUD and specific logic
* DB connections per tenant
  And must scale independently from the control plane. ([wild.codes][4])

---

## **Permissions and Authorization**

* **RBAC** — Fixed roles (admin, editor, user).
* **ABAC** — Attribute-based policy (role *and* business conditions).
* **ReBAC** — Relationship-based (e.g., owners and resources).

In multi-tenant, the separation of roles and permissions must respect the *tenant boundary*.

---

## **Scalability and Performance**

### Cache and tenant-aware caching

* Cache per tenant → prevents data contamination. ([UMA Technology][6])

### API Gateway multitenancy

* **Rate limiting per tenant**
* **CORS and WAF per tenant**
* **Tenant-scoped metrics** for observability. ([UMA Technology][6])

#### Definitions
- CORS, or Cross-Origin Resource Sharing, is a security feature that allows web applications to request resources from different origins (domains) while ensuring safe data transfers.
- WAF, or Web Application Firewall, is a security system that monitors and filters HTTP traffic to and from a web application to protect it from various attacks.

---

## **Multi-Tenant Observability**

* Store metrics *per tenant* (p95, errors)
* Log with tenant ID for auditing
* Implement distributed traces with tenant context

This will allow us to react to bottlenecks per client. ([Coretus Technologies][5])

---

## **Billing & Usage Metering**

Mature SaaS architecture not only serves data, it also:

* Counts API calls per tenant
* Calculates storage used per tenant
* Generates plans and limits by tiers
* Produces reports and invoices
  In other words: you must have *usage events* and *accumulators* in the control plane. ([Coretus Technologies][5])

---

## **Schema Evolution and Metadata Versioning**

Key concepts:

* **Metadata versioning:** each schema change must be associated with a *version tag*.
* **Metadata backups and rollback:** you'll need mechanisms to revert to a previous state.
* **Event-triggered migrations:** you can apply global or per-tenant migrations.

This topic is usually found in advanced books and articles on SaaS architecture and data engineering (e.g., O'Reilly on SaaS). ([O'Reilly Media][7])

---

## **Query Abstraction vs DSL**

A real BaaS usually requires:

* Basic CRUD
* Complex filters (AND/OR)
* Joins and relationships
* Cursor pagination
* Aggregations
* Multi-tenant transactions

Study how projects like Hasura or Prisma do it — both support complex queries translated to multiple engines.

---

## **Security, Compliance, and Data Custody**

It should be covered:

* **Strong data isolation**
* **Encryption at rest/in transit**
* **Access auditing**
* **Log protection**
* **GDPR/SOC2 compliance**

This affects not only code, but also DevOps processes and SaaS architecture. ([xappifai.com][2])

---

## **Infrastructure and Multi-Tenant Kubernetes**

If we will use Kubernetes, look at:

* Namespaces per tenant
* Strict ResourceQuotas
* NetworkPolicies
* Secret per tenant

This not only provides network isolation, but also operational control. ([Isitdev][8])

---

## 📌 Summary of Key References

Areas covered by real content:

| Topic                                  | Source                      |
| -------------------------------------- | --------------------------- |
| Multi-tenant strategies                | ([The Algorithm][1])        |
| Tenant isolation patterns              | ([xappifai.com][2])         |
| SaaS control/data plane architecting   | ([wild.codes][4])           |
| Billing & telemetry                    | ([Coretus Technologies][5]) |
| Observabilidad tenant-aware            | ([UMA Technology][6])       |
| Kubernetes multi-tenant best practices | ([Isitdev][8])              |
| SaaS design principles                 | ([O'Reilly Media][7])       |

---

[1]: https://www.the-algo.com/post/saas-architecture-best-practices-in-2025?utm_source=chatgpt.com "SaaS Architecture Best Practices in 2025"
[2]: https://www.xappifai.com/blog/saas-architecture-complete?utm_source=chatgpt.com "SaaS Architecture: Complete Guide to Building Scalable Multi-Tenant Systems | XAppifai Blog"
[3]: https://www.educative.io/newsletter/system-design/architecting-saas-multi-tenancy-for-isolation-and-scale?utm_source=chatgpt.com "Architecting SaaS Multi-Tenancy for Isolation and Scale"
[4]: https://wild.codes/candidate-toolkit-question/how-would-you-architect-a-secure-multi-tenant-saas?utm_source=chatgpt.com "How would you architect a secure multi-tenant SaaS?"
[5]: https://www.coretus.com/saas-platform-engineering-services/multi-tenant-saas-architecture-design?utm_source=chatgpt.com "Multi-Tenant SaaS Platform Engineering | Tenant Isolation, Billing, RBAC | Coretus"
[6]: https://umatechnology.org/multi-tenant-api-gateway-optimizations-for-backend-as-a-service-apis-rated-by-enterprise-architects/?utm_source=chatgpt.com "Multi-Tenant API Gateway Optimizations for backend-as-a-service APIs rated by enterprise architects - UMA Technology"
[7]: https://www.oreilly.com/library/view/building-multi-tenant-saas/9781098140632/ch02.html?utm_source=chatgpt.com "2. Multi-Tenant Architecture Fundamentals - Building Multi-Tenant SaaS Architectures [Book]"
[8]: https://isitdev.com/multi-tenant-saas-architecture-cloud-2025/?utm_source=chatgpt.com "Multi‑Tenant SaaS Architecture on Cloud (2025) — Practical Guide"


# **SaaS Architecture**

## **1. Architectural Vision**

	We are not building a backend.

	We are building a programmable backend runtime.

The system must:

* Support unbounded tenant diversity
* Be engine-agnostic
* Adapt at runtime
* Provide strict tenant isolation
* Scale independently across planes
* Enable monetization and governance

## **2. High Level Architecture**

The platform will be separated into two macro domains:

```mermaid
graph TB
    subgraph CP["CONTROL PLANE"]
        TM[Tenant Management]
        MS[Metadata Store]
        SV[Schema Versioning]
        APE[Auth & Policy Engine]
        BM[Billing & Metering]
        AA[Admin API]
    end
    
    subgraph DP["DATA PLANE"]
        DAR[Dynamic API Runtime]
        AEF[Adapter Engine Factory]
        VE[Validation Engine]
        HRS[Hook Runtime Sandbox]
        RE[Realtime Engine]
        QE[Query Execution]
    end
    
    CP -->|Configuration & Policies| DP
    DP -->|Data Access| EDB[(External Databases)]
    
    style CP fill:#e1f5ff,stroke:#333,stroke-width:2px
    style DP fill:#fff4e1,stroke:#333,stroke-width:2px
    style EDB fill:#f0f0f0,stroke:#333,stroke-width:2px
```

## **3. Control Plane Architecture**
The Control Plane is responsible for platform governance, not data execution.

#### **Responsibilities**

* Tenant lifecycle (create / suspend / delete)
* Store tenant DB connection configs
* Metadata storage
* Policy definitions (RBAC / ABAC)
* Hook definitions
* Usage metering
* Billing computation
* Plan enforcement

#### **Design Principle**

	Control plane failure must NOT break data plane execution.

This means:

* Data plane must cache metadata
* Policy snapshots must be locally available
* DB adapter configs must be cached

### **3.1 Metadata Storage Design**
Each tenant will have:
```json
{
  "tenantId": "user_23",
  "dbConfig": {...},
  "schemaVersions": [
    { "version": 1, "entities": [...] },
    { "version": 2, "entities": [...] }
  ],
  "activeVersion": 2,
  "policies": {...},
  "limits": {...}
}
```

#### **Required Capabilities**
* Version tagging
* Rollback support
* Immutable historical versions
* Migration orchestration events

## **4. Data Plane Architecture**
The Data Plane executes user workloads.

It must be:

* Stateless
* Horizontally scalable
* Tenant-aware
* Adapter-injected per request

### **4.1 Request Flow Diagram**

```mermaid
graph TD
    CR[Client Request]
    AG[API Gateway<br/>rate limit, auth validation]
    TCR[Tenant Context Resolver]
    MCL[Metadata Cache Lookup]
    PE[Policy Engine<br/>inject row/field rules]
    DAF[Database Adapter Factory]
    QE[Query Execution]
    HE[Hook Execution<br/>isolated runtime]
    TL[Transform Layer]
    R[Response]
    
    CR --> AG
    AG --> TCR
    TCR --> MCL
    MCL --> PE
    PE --> DAF
    DAF --> QE
    QE --> HE
    HE --> TL
    TL --> R
    
    style CR fill:#e8f5e9,stroke:#333,stroke-width:2px
    style AG fill:#fff3e0,stroke:#333,stroke-width:2px
    style TCR fill:#e3f2fd,stroke:#333,stroke-width:2px
    style MCL fill:#f3e5f5,stroke:#333,stroke-width:2px
    style PE fill:#ffe0b2,stroke:#333,stroke-width:2px
    style DAF fill:#e1f5fe,stroke:#333,stroke-width:2px
    style QE fill:#fff9c4,stroke:#333,stroke-width:2px
    style HE fill:#f1f8e9,stroke:#333,stroke-width:2px
    style TL fill:#fce4ec,stroke:#333,stroke-width:2px
    style R fill:#e8f5e9,stroke:#333,stroke-width:2px
```

## **5. Multi-Tenant Isolation Strategy**
You must formally choose isolation at three layers:

### **5.1 Data Isolation**

Options:

1. Shared DB + tenant_id column
2. Shared DB + separate schema
3. DB per tenant
4. Cluster per tenant

#### **Recommended Hybrid Model**

* Small tenants → Shared DB + Row-Level Security
* Enterprise tenants → Dedicated database

This is how modern SaaS systems scale efficiently.

### **5.2 Compute Isolation**

Options:

* Shared pods (tenant context inside app)
* Kubernetes namespace per tenant
* Dedicated node pools per enterprise tenant

Use:

* Resource quotas
* CPU/memory limits
* Hook execution time caps

### **5.3 Cache Isolation**

Redis keys must be namespaced:
```bash 
tenant:user_23:entity:books:page:1
```
Never share cache keys across tenants.

### **6. Dynamic Schema & Versioning Pattern**

#### **Core Rule:**


Schema is immutable once activated.

New changes → new version.
```bash
v1 → v2 → v3
```

#### **Version Activation Flow**
```mermaid
graph TD
    UAS[User update schema]
    NMVC[New metadata version created]
    VCC[Validator compiled & cached]
    VA[Version Activated]
    
    UAS --> NMVC
    NMVC --> VCC
    VCC --> VA
    
    style UAS fill:#e8f5e9,stroke:#333,stroke-width:2px
    style NMVC fill:#fff3e0,stroke:#333,stroke-width:2px
    style VCC fill:#e3f2fd,stroke:#333,stroke-width:2px
    style VA fill:#f3e5f5,stroke:#333,stroke-width:2px
```
#### **Backward Compatibility Strategy**

* Option A: Clients always use latest
* Option B: Client passes x-schema-version

## **7. Query Abstraction Layer Design**
Our current CRUD interface is insufficient long-term.

We need a Query DSL.

Example of internal representation:
```js
{
  filter: { price: { gt: 10 } },
  sort: [{ field: "createdAt", order: "desc" }],
  limit: 20,
  cursor: "abc123",
  relations: ["author"]
}
```

Adapters translate this into:

* SQL (Knex)
* Mongo query object
* Future engines

This allows:

* Aggregations
* Joins
* Nested relations
* Cursor pagination
* Transaction abstraction

## **8. Authorization Model**
We need a hybrid ABAC + Row-Level strategy.

### **Policy Injection Pattern**
Instead of 
```js
adapter.findMany("books", {})
```
We rewrite internally:
```js
adapter.findMany("books", {
	ownerId: currentUser.id
})
```

### **Layers of Authorization**

1. Tenant boundary
2. Role-based permission
3. Row-level constraint
4. Field-level masking

## **9. Hook Execution Model**
Hooks must be:

* Time limited
* Memory limited
* Network restricted
* Executed in isolated VM

Execution flow:
```mermaid
graph TD
    ET[Event Triggered]
    SP[Serialized Payload]
    IVMI[Isolated-vm instance]
    TG[Timeout guard]
    SR[Safe result or forced termination]
    
    ET --> SP
    SP --> IVMI
    IVMI --> TG
	TG --> SR
    
    style ET fill:#e8f5e9,stroke:#333,stroke-width:2px
    style SP fill:#fff3e0,stroke:#333,stroke-width:2px
    style IVMI fill:#e3f2fd,stroke:#333,stroke-width:2px
    style TG fill:#f3e5f5,stroke:#333,stroke-width:2px
    style SR fill:#f8f5f5,stroke:#333,stroke-width:2px
```

## **10. Observability Model**
Observability must be tenant-aware.

### **Metrics**

* p95 latency per tenant
* error rate per tenant
* query volume per tenant
* storage usage per tenant

### **Logging**

All logs must include:
* tenantId
* requestId
* schemaVersion
* adapterType

## **11. Billing & Meeting Architecture**
Usage events emitted by data plane:
```js
{
  tenantId,
  type: "read" | "write" | "storage" | "hook_cpu",
  units: number,
  timestamp
}
```
Events go to:
```
Data Plane → Usage Event Stream → Control Plane Billing Aggregator
```
Never compute billing inside request cycle.

## **12. Caching Strategy**

We need three layers:

* Metadata Cache (per tenant)
* Compiled Validator Cache
* Query Result Cache (optional)

All must be:

* TTL controlled
* Tenant namespaced
* Invalidated on schema version change

## **Consistency Model**
We must explicitly define guarantees:

| Feature            | SQL  | Mongo            | Platform Guarantee |
| ------------------ | ---- | ---------------- | ------------------ |
| Transactions       | ACID | limited          | Best effort        |
| Strong consistency | Yes  | Yes (single doc) | Engine-dependent   |
| Cross-engine join  | No   | No               | Not supported      |

Never promise more than the weakest engine supports.

## **14. Deployment Topology**

Recommended baseline:

```
Kubernetes Cluster
├── control-plane namespace
├── data-plane namespace
├── redis
├── monitoring stack
```
Enterprise tier:

* Dedicated namespace
* Dedicated DB
* Separate autoscaling group

## **15. Failure Domains**

Design so that:

* Tenant DB outage affects only that tenant
* Hook crash does not crash worker
* Control plane downtime does not break cached data plane
* Redis outage degrades performance, not correctness

## **16. Governance & Limits**

Every tenant must have enforced limits:

* Max entities
* Max fields per entity
* Max payload size
* Max hook CPU
* Max requests per minute

These are defined in control plane and enforced in gateway/data plane.

## **17. System Maturity Stages**

You should think in stages:

- Stage 1 — Logical multi-tenancy
- Stage 2 — Query DSL + policy injection
- Stage 3 — Versioned metadata
- Stage 4 — Billing + quotas
- Stage 5 — Enterprise isolation tiers

## **18. Final Architectural Principles**

1. Metadata is the source of truth.
2. Isolation must exist at every layer.
3. Control plane and data plane must be separable.
4. Never promise stronger guarantees than weakest engine.
5. Every feature must be tenant-aware.
6. Performance must be cache-driven.
7. Governance must be enforceable automatically.