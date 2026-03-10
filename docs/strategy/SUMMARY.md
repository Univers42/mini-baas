# mini-baas Strategy - Unified Architecture, Database Rationale, and Execution Plan

> This document is the canonical strategic synthesis of `BaaS.md`, `MDD_BAAS.md`, `whymongo.md`, and `dylan.md`.
> It defines the product thesis, architecture decisions, risk posture, implementation stages, and measurable success criteria.

# todo: añadir un preaumbulo para convencer al lector
# todo: añadir todos los diagramas que se han hecho con sentido y en orden
# todo: añadir toda la información posible para que todos sepamos cuál es la estrategia.
		esta debe ser de manera gradual para que podamos entender todos (tanto de dentro como de fuera del proyecto)

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Thesis and Non-Negotiables](#2-product-thesis-and-non-negotiables)
3. [Architectural Decision Framework](#3-architectural-decision-framework)
4. [Plane Architecture and Responsibilities](#4-plane-architecture-and-responsibilities)
5. [Master Document as the Runtime Contract](#5-master-document-as-the-runtime-contract)
6. [Why MongoDB for the Control Plane](#6-why-mongodb-for-the-control-plane)
7. [Multi-Tenant Isolation Model](#7-multi-tenant-isolation-model)
8. [Authorization and Policy Enforcement](#8-authorization-and-policy-enforcement)
9. [Query Abstraction and Adapter Strategy](#9-query-abstraction-and-adapter-strategy)
10. [Universal Module Surface](#10-universal-module-surface-from-dylanmd)
11. [Runtime Risk Register and Mitigations](#11-runtime-risk-register-and-mitigations)
12. [Consistency and Guarantee Matrix](#12-consistency-and-guarantee-matrix)
13. [Implementation Stages (Pragmatic Roadmap)](#13-implementation-stages-pragmatic-roadmap)
14. [SLOs and Success Metrics](#14-slos-and-success-metrics)
15. [Governance and Compliance Baseline](#15-governance-and-compliance-baseline)
16. [Strategic Position for ft_transcendence](#16-strategic-position-for-ft_transcendence)
17. [Final Synthesis](#17-final-synthesis)
18. [Official Sources and References](#18-official-sources-and-references)
19. [Source Documents](#19-source-documents)

---

## 1. Executive Summary

`mini-baas` is not a fixed backend template. It is a metadata-driven App Factory that changes behavior at runtime per tenant, without hardcoded business schemas.

The platform is designed around two planes:

- Control Plane: governance, metadata, policy, billing, version management.
- Data Plane: stateless execution runtime that interprets Control Plane metadata and executes CRUD, validation, and hooks.

The strategic choice is:

- [MongoDB](https://www.mongodb.com/docs/) as the primary Control Plane store.
- An adapter-based Data Plane for database agnosticism across [PostgreSQL](https://www.postgresql.org/docs/), [MySQL](https://dev.mysql.com/doc/), [MariaDB](https://mariadb.com/kb/en/documentation/), [SQLite](https://sqlite.org/docs.html), and MongoDB.
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
8. Convention over configuration, configuration over code: secure defaults are provided but tenant-level overrides are allowed.

---

## 3. Architectural Decision Framework

### 3.1 Alternatives Evaluated

1. Code generation + infra orchestration (Supabase-style).
2. Serverless edge ([Cloudflare Workers](https://developers.cloudflare.com/workers/) / [Firebase](https://firebase.google.com/docs)-style).
3. Pure NoSQL runtime.
4. Metadata-driven modular monolith (chosen).

### 3.2 Why Metadata-Driven Modular Monolith Wins Here

- Lower operational overhead than large microservice fleets.
- Better self-hosting story via [Docker Compose](https://docs.docker.com/compose/).
- Cleaner path to runtime adaptability than static code generation.
- Stronger local control over hooks, policies, and data custody.

### 3.3 Strategic Tradeoff

The chosen model increases runtime complexity (dynamic validation, policy injection, hook sandboxing), but buys superior product flexibility and feature velocity.

---

## 4. Plane Architecture and Responsibilities

The architecture follows a three-plane model inspired by [Kubernetes control plane/data plane separation](https://kubernetes.io/docs/concepts/overview/components/):

- Control Plane: governance and metadata authority.
- Engine Plane: adapter factory, connection management, query translation.
- Data Plane: request execution runtime.

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

### 4.3 Engine Plane

Owns portability and translation:

- Adapter factory and engine resolution.
- Connection pooling.
- Query intermediate representation (IR) to native engine query translation.
- Cross-engine type normalization and capability mapping.

### 4.4 Separation Rule

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

A practical reference structure is aligned with the architecture implemented in NestJS modules and interfaces (for example, `IDatabaseDriver`) and follows [NestJS architecture guidance](https://docs.nestjs.com/).

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

Operationally, this uses MongoDB capabilities such as [JSON Schema validation](https://www.mongodb.com/docs/manual/core/schema-validation/) and indexed nested fields.

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

This is the Adapter Pattern in practice and mirrors the intent of a universal data access layer; see [refactoring.guru Adapter Pattern](https://refactoring.guru/design-patterns/adapter).

### 9.2 Query IR Model

Dynamic API modules should express query intent through an internal IR (filters, sort, pagination, projection, relation hints), then adapters translate IR to native SQL or Mongo queries.

This keeps business modules engine-agnostic and reduces feature drift across engines.

### 9.3 Evolution Path

1. Phase 1 (MVP): MongoAdapter as default execution engine.
2. Phase 2: PostgresAdapter for strict relational workloads and evaluation requirements.
3. Phase 3: intelligent routing/provisioning by schema shape and policy.

### 9.4 Explicit Constraint

No cross-engine joins are promised. The platform surface must express only guarantees that all supported engines can honor safely.

---

## 10. Universal Module Surface

The strategic module surface of `mini-baas` is not limited to CRUD. It includes reusable platform capabilities, each expected to remain adapter-driven:

- Authentication and session management.
- RBAC and policy-driven authorization.
- Audit trail and compliance workflows (including GDPR operations).
- File metadata/storage orchestration.
- Notifications, newsletter, and communication primitives.
- Analytics events and webhook delivery.
- API key lifecycle and scoped access.
- Security guardrails (rate limiting, sanitization, IP filtering, security headers).

This module breadth is part of the product thesis: one reusable backend runtime for many frontend/business models.

---

## 11. Runtime Risk Register and Mitigations

### 11.1 Dynamic Validation Hot Path

Risk:
Schema compilation on request path can saturate the event loop.

Mitigation:
- Precompile validators.
- Cache by `tenantId + schemaVersion + entity`.
- Warm caches proactively on activation.

### 11.2 Hook Sandbox Stability

Risk:
Infinite loops, memory spikes, noisy-neighbor compute starvation.

Mitigation:
- Isolate pool with strict memory caps.
- Hard execution timeout and cancellation.
- Network isolation by default.
- Tenant-level hook rate limits.

Implementation guidance should align with [Node.js worker/isolation security practices](https://nodejs.org/api/vm.html) and strict process-level resource limits.

### 11.3 Control Plane Dependency

Risk:
Metadata unavailability blocks requests.

Mitigation:
- Multi-layer cache (memory + Redis).
- Stale-read fallback windows.
- Background refresh and invalidation events.

### 11.4 Billing in Request Cycle

Risk:
Synchronous metering inflates latency.

Mitigation:
- Emit usage events asynchronously.
- Aggregate in background workers ([BullMQ](https://docs.bullmq.io/)).
- Serve dashboards from computed snapshots.

---

## 12. Consistency and Guarantee Matrix

The product contract must be explicit:

- Single-entity operations: strong consistency at engine-defined level.
- Cross-entity, cross-engine operations: best effort and eventually consistent orchestration.
- Transactions: adapter/engine dependent.
- Global guarantees must document fallback semantics and failure behavior.

This prevents overpromising and aligns API semantics with real infrastructure capabilities.

---

## 13. Implementation Stages (Pragmatic Roadmap)

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

### Stage 8 - Verification and Hardening

- Cross-engine parity tests for CRUD and policy behavior.
- Tenant isolation tests (token, key, and data boundaries).
- Security regression tests (injection payloads, rate abuse, hook limits).
- SLO verification under load and cache miss/hit scenarios.

---

## 14. SLOs and Success Metrics

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

## 15. Governance and Compliance Baseline

### 15.1 Required Technical Controls

- Encryption in transit and at rest.
- Tenant-scoped audit trails.
- Immutable event logs for critical actions.
- Secrets isolation and rotation policy.

Use modern cryptographic guidance from [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) and [NIST](https://csrc.nist.gov/publications).

### 15.2 Operational Controls

- Per-tenant quotas for entity count, payload size, request rate, hook resources.
- Incident playbooks for tenant DB outage, Redis outage, hook abuse.
- Policy review process for privilege model evolution.

---

## 16. Strategic Position for ft_transcendence

To satisfy strict evaluator expectations about schema clarity and relations while preserving App Factory flexibility:

1. Keep Control Plane in MongoDB with strict schema validation for metadata integrity.
2. Implement SQL adapter path with explicit relational modeling for qualified tenants/workloads.
3. Demonstrate clear ER outputs for relational mode.
4. Preserve a single runtime orchestration model through adapter abstraction.

This avoids false dichotomies between flexibility and formal relational rigor.

---

## 17. Final Synthesis

The combined strategy is intentionally hybrid:

- Document-native governance where metadata volatility is highest.
- Adapter-driven data execution where workload diversity is highest.
- Strong isolation and observability where multi-tenancy risk is highest.

In practical terms, `mini-baas` succeeds if it can safely execute unknown tenant models at runtime, keep performance stable under tenant growth, and evolve schemas without downtime while remaining auditable and evaluable in formal academic/enterprise contexts.

---

## 18. Official Sources and References

### 18.1 Core Technologies

- NestJS docs: <https://docs.nestjs.com/>
- Node.js docs: <https://nodejs.org/docs/latest/api/>
- TypeScript handbook: <https://www.typescriptlang.org/docs/>
- MongoDB docs: <https://www.mongodb.com/docs/>
- PostgreSQL docs: <https://www.postgresql.org/docs/>
- MySQL docs: <https://dev.mysql.com/doc/>
- MariaDB docs: <https://mariadb.com/kb/en/documentation/>
- SQLite docs: <https://sqlite.org/docs.html>
- Redis docs: <https://redis.io/docs/latest/>
- Docker docs: <https://docs.docker.com/>

### 18.2 Security and Compliance

- OWASP Cheat Sheet Series: <https://cheatsheetseries.owasp.org/>
- OWASP ASVS: <https://owasp.org/www-project-application-security-verification-standard/>
- JWT RFC 7519: <https://www.rfc-editor.org/rfc/rfc7519>
- NIST Cybersecurity Resources: <https://csrc.nist.gov/>

### 18.3 Architecture and Patterns

- Kubernetes architecture concepts: <https://kubernetes.io/docs/concepts/overview/components/>
- Adapter Pattern reference: <https://refactoring.guru/design-patterns/adapter>
- Polyglot persistence (Martin Fowler): <https://martinfowler.com/bliki/PolyglotPersistence.html>

---

## 19. Source Documents

- `docs/strategy/BaaS.md`
- `docs/strategy/MDD_BAAS.md`
- `docs/strategy/whymongo.md`
- `docs/strategy/dylan.md`

