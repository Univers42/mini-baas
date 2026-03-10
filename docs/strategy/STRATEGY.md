# mini-baas Strategy - Unified Architecture, Database Rationale, and Execution Plan

> This document is the canonical strategic synthesis of `BaaS.md`, `MDD_BAAS.md`, and `whymongo.md`.
> It defines the product thesis, architecture decisions, risk posture, implementation stages, and measurable success criteria.

---

## 1. Executive Summary

`mini-baas` is not a fixed backend template. It is a metadata-driven App Factory that changes behavior at runtime per tenant, without hardcoded business schemas.

The platform is designed around two planes:

- Control Plane: governance, metadata, policy, billing, version management.
- Data Plane: stateless execution runtime that interprets Control Plane metadata and executes CRUD, validation, and hooks.

The strategic choice is:

- MongoDB as the primary Control Plane store.
- An adapter-based Data Plane for database agnosticism.
- A phased execution strategy: Mongo-first MVP, SQL adapter hardening later.

This combination maximizes delivery speed, preserves architectural optionality, and addresses ft_transcendence constraints around explicit schemas and relations.

---

## 2. Product Thesis and Non-Negotiables

### 2.1 Core Thesis

The system must be able to host unbounded tenant diversity by interpreting tenant metadata (the Master Document) as runtime instructions.

### 2.2 Non-Negotiable Principles

1. Metadata is the source of truth for runtime behavior.
2. Every operation is tenant-scoped by default.
3. Control Plane and Data Plane must be independently evolvable.
4. Isolation must exist at data, compute, cache, and observability layers.
5. Runtime flexibility cannot bypass governance or security.
6. Platform guarantees must not exceed the weakest active engine.
7. Expensive work is asynchronous whenever possible (billing, aggregation, migrations).

---

## 3. Architectural Decision Framework

### 3.1 Alternatives Evaluated

1. Code generation + infra orchestration (Supabase-style).
2. Serverless edge (Firebase/Cloudflare-style).
3. Pure NoSQL runtime.
4. Metadata-driven modular monolith (chosen).

### 3.2 Why Metadata-Driven Modular Monolith Wins Here

- Lower operational overhead than large microservice fleets.
- Better self-hosting story via Docker Compose.
- Cleaner path to runtime adaptability than static code generation.
- Stronger local control over hooks, policies, and data custody.

### 3.3 Strategic Tradeoff

The chosen model increases runtime complexity (dynamic validation, policy injection, hook sandboxing), but buys superior product flexibility and feature velocity.

---

## 4. Control Plane and Data Plane Responsibilities

### 4.1 Control Plane

Owns governance and platform intelligence:

- Tenant lifecycle and status.
- Master Document storage and versioning.
- Policy definitions (RBAC baseline, ABAC/ReBAC-ready evolution).
- Limits/quotas and plan metadata.
- Usage metering and computed billing aggregates.
- Migration orchestration and rollback pointers.

### 4.2 Data Plane

Owns request execution:

- Tenant context resolution per request.
- Metadata lookup and cache hydration.
- Dynamic payload validation from metadata.
- Policy injection into query constraints.
- Adapter-resolved execution per engine.
- Optional hook execution in hardened isolates.

### 4.3 Separation Rule

Control Plane degradation should not instantly break Data Plane reads/writes for cached tenants. Data Plane must continue in degraded mode with bounded staleness.

---

## 5. Master Document as the Runtime Contract

Every tenant is represented by a Master Document with, at minimum:

- `tenantId`, `status`.
- `database.engine` + `database.uri`.
- `schema`, `permissions`, optional `hooks`.
- `version` for schema evolution.
- optional computed domains (`billing.computed`, metrics snapshots).

The Master Document is not just configuration. It is executable governance metadata:

- It controls what can be created/read/updated/deleted.
- It controls where data is written.
- It controls what code may run in hooks.

---

## 6. Why MongoDB for the Control Plane

MongoDB is selected for the Control Plane because its document modeling patterns directly match the hardest Control Plane constraints.

### 6.1 Pattern-to-Problem Mapping

1. Polymorphic pattern:
All tenants in one collection despite heterogeneous schemas.

2. Computed pattern:
Pre-compute expensive billing/usage summaries for O(1) reads.

3. Approximation pattern:
Reduce high-volume telemetry writes by buffered threshold flushes.

4. Schema versioning pattern:
Allow v1/v2/v3 tenant metadata to coexist with lazy migration.

5. Schema validation:
Reject malformed metadata at database boundary before runtime execution.

### 6.2 Consequence

MongoDB in `mini-baas` is primarily a governance metadata engine (Control Plane), not a universal mandate for tenant business data.

---

## 7. Multi-Tenant Isolation Model

Isolation is explicit across four layers.

### 7.1 Data Isolation

- Default tier: shared database with strict tenant scoping.
- Enterprise tier: dedicated database (and optional dedicated namespace).

### 7.2 Compute Isolation

- Hook execution in `isolated-vm`.
- CPU/memory/time quotas.
- Forced termination and circuit breakers for abusive hooks.

### 7.3 Cache Isolation

- Mandatory tenant namespacing for keys.
- Version-aware cache keys for schemas and validators.

### 7.4 Observability Isolation

- Every metric/log/trace tagged with `tenantId` and `correlationId`.
- Per-tenant SLO visibility (latency, error rate, saturation).

---

## 8. Authorization and Policy Enforcement

### 8.1 Recommended Direction

- Start with RBAC for coarse role boundaries.
- Layer ABAC for row/field constraints.
- Add ReBAC where graph relationships become product-critical.

### 8.2 Policy Injection Pattern

Data Plane never executes unconstrained queries. It rewrites incoming operations with tenant and policy predicates before adapter execution.

Example of implicit enforcement:

- Tenant boundary predicate.
- Ownership/organization predicate.
- Field-level projection masking.

---

## 9. Query Abstraction and Adapter Strategy

### 9.1 Interface Contract

The runtime depends on `IDatabaseDriver`, not a concrete engine.

### 9.2 Evolution Path

1. Phase 1 (MVP): MongoAdapter as default execution engine.
2. Phase 2: PostgresAdapter for strict relational workloads and evaluation requirements.
3. Phase 3: intelligent routing/provisioning by schema shape and policy.

### 9.3 Explicit Constraint

No cross-engine joins are promised. The platform surface must express only guarantees that all supported engines can honor safely.

---

## 10. Runtime Risk Register and Mitigations

### 10.1 Dynamic Validation Hot Path

Risk:
Schema compilation on request path can saturate the event loop.

Mitigation:
- Precompile validators.
- Cache by `tenantId + schemaVersion + entity`.
- Warm caches proactively on activation.

### 10.2 Hook Sandbox Stability

Risk:
Infinite loops, memory spikes, noisy-neighbor compute starvation.

Mitigation:
- Isolate pool with strict memory caps.
- Hard execution timeout and cancellation.
- Network isolation by default.
- Tenant-level hook rate limits.

### 10.3 Control Plane Dependency

Risk:
Metadata unavailability blocks requests.

Mitigation:
- Multi-layer cache (memory + Redis).
- Stale-read fallback windows.
- Background refresh and invalidation events.

### 10.4 Billing in Request Cycle

Risk:
Synchronous metering inflates latency.

Mitigation:
- Emit usage events asynchronously.
- Aggregate in background workers (BullMQ).
- Serve dashboards from computed snapshots.

---

## 11. Consistency and Guarantee Matrix

The product contract must be explicit:

- Single-entity operations: strong consistency at engine-defined level.
- Cross-entity, cross-engine operations: best effort and eventually consistent orchestration.
- Transactions: adapter/engine dependent.
- Global guarantees must document fallback semantics and failure behavior.

This prevents overpromising and aligns API semantics with real infrastructure capabilities.

---

## 12. Implementation Stages (Pragmatic Roadmap)

### Stage 1 - Tenant Context and Governance Foundation

- Tenant interceptor/context resolver.
- Control Plane metadata schema and storage.
- Cache namespace strategy.

### Stage 2 - Data Plane MVP with Mongo Adapter

- Dynamic CRUD pipeline.
- Adapter factory and interface contract.
- Basic policy gates.

### Stage 3 - Validation and Security Hardening

- Dynamic validator compilation/caching.
- Input and schema guardrails.

### Stage 4 - Versioning and Migration Mechanics

- Immutable metadata versions.
- Active version pointer.
- Lazy migration handlers.

### Stage 5 - Hook Runtime Isolation

- `isolated-vm` runtime.
- Quotas, timeouts, error isolation.

### Stage 6 - Usage Events, Billing, and Quotas

- Event emission from Data Plane.
- Computed billing aggregates.
- Tier enforcement and quota reactions.

### Stage 7 - SQL Adapter and Enterprise Isolation Tier

- Postgres adapter.
- Relational mode and ER-friendly outputs.
- Dedicated tenant topology options.

---

## 13. SLOs and Success Metrics

Minimum measurable outcomes to validate strategy execution:

1. Context Resolution Latency:
P95 metadata resolution (cache hit) <= 10 ms.

2. Data Plane Baseline Latency:
P95 CRUD request <= 100 ms (excluding tenant DB network extremes).

3. Cache Effectiveness:
Metadata cache hit ratio >= 95% for active tenants.

4. Hook Safety:
100% of over-budget hooks terminated without process crash.

5. Billing Freshness:
Computed billing snapshot lag <= 1 hour.

6. Isolation Integrity:
0 tolerated cross-tenant data leakage incidents.

7. Version Rollback Readiness:
Rollback operation to previous metadata version <= 5 minutes operational procedure.

---

## 14. Governance and Compliance Baseline

### 14.1 Required Technical Controls

- Encryption in transit and at rest.
- Tenant-scoped audit trails.
- Immutable event logs for critical actions.
- Secrets isolation and rotation policy.

### 14.2 Operational Controls

- Per-tenant quotas for entity count, payload size, request rate, hook resources.
- Incident playbooks for tenant DB outage, Redis outage, hook abuse.
- Policy review process for privilege model evolution.

---

## 15. Strategic Position for ft_transcendence

To satisfy strict evaluator expectations about schema clarity and relations while preserving App Factory flexibility:

1. Keep Control Plane in MongoDB with strict schema validation for metadata integrity.
2. Implement SQL adapter path with explicit relational modeling for qualified tenants/workloads.
3. Demonstrate clear ER outputs for relational mode.
4. Preserve a single runtime orchestration model through adapter abstraction.

This avoids false dichotomies between flexibility and formal relational rigor.

---

## 16. Final Synthesis

The combined strategy is intentionally hybrid:

- Document-native governance where metadata volatility is highest.
- Adapter-driven data execution where workload diversity is highest.
- Strong isolation and observability where multi-tenancy risk is highest.

In practical terms, `mini-baas` succeeds if it can safely execute unknown tenant models at runtime, keep performance stable under tenant growth, and evolve schemas without downtime while remaining auditable and evaluable in formal academic/enterprise contexts.

---

## 17. Source Documents

- `docs/strategy/BaaS.md`
- `docs/strategy/MDD_BAAS.md`
- `docs/strategy/whymongo.md`

