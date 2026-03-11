# mini-baas — Infrastructure Checkpoint: The Great Purge & Rebirth

> **Date:** March 2026  
> **Phase:** Phase 0 (Infrastructure & DevX Preparation)  
> **Status:** Completed  

## 1. Executive Summary

Before writing the first line of TypeScript for the `mini-baas` engine, it was mandatory to sever all ties with the legacy static architecture (the "Vite Gourmand" monorepo). 

The legacy environment was tightly coupled to **Prisma** (static schemas), **Frontend SPA serving** (Nginx), and **hardcoded business logic**. We have successfully dismantled this legacy infrastructure and laid down a clean, optimized, and strictly governed environment tailored for the **Polyglot App Factory**.

This document serves as a checkpoint summarizing the infrastructure changes made to support the Phase 0 roadmap.

---

## 2. The Great Purge (What We Removed)

To enforce the *Zero Business Logic Awareness* principle, we systematically removed components that violated the dynamic nature of a BaaS:

1.  **The Monorepo Illusion:** Deleted the root `package.json`, `pnpm-lock.yaml`, and the `packages/shared/` directory. `mini-baas` is a standalone, headless backend engine, not a full-stack workspace.
2.  **The Prisma Exorcism:** Eradicated all traces of `@prisma/client`, the `prisma/` directory, `schema.prisma`, and associated migration scripts. Static ORMs are fundamentally incompatible with runtime schema discovery.
3.  **Frontend & Proxy Baggage:** Deleted `docker/nginx.conf`. The BaaS exposes pure APIs and does not serve static HTML interfaces.
4.  **Zombie Scripts:** Removed over 30 legacy bash scripts from the `scripts/` directory that were hardcoded to run Prisma commands, deploy static frontends, or interact with an external Supabase instance.

---

## 3. Infrastructure Rebirth (What We Built)

We established the "Data Trinity" required by the new Three-Plane Architecture.

### 3.1 The Docker Compose Stack
The local development environment (`docker-compose.dev.yml`) was completely rewritten to launch the required infrastructure:
* **`baas-system-db` (MongoDB 7):** The *Control Plane*. Stores the Master Documents, tenant configurations, and system metadata.
* **`baas-tenant-db` (PostgreSQL 16):** The *Data Plane (Phase 2)*. Provisioned to test the SQL Adapter ("The ft_transcendence Shield") and relational isolation.
* **`baas-redis` (Redis 7):** The *Cache Plane*. Essential for tenant metadata caching, rate limiting, and pub/sub.
* **`baas-dev-engine` (Node.js 22):** The NestJS runtime, now mapping its volume to a clean `backend/` directory.

### 3.2 The Polyglot Package (`backend/package.json`)
Created a fresh, strict package configuration for the backend engine:
* **Added:** `knex`, `mongodb`, `mongoose` (for the Adapter Pattern).
* **Added:** `ajv`, `ajv-formats` (for the dynamic Validation Engine).
* **Added:** `@casl/ability` (for the ABAC Policy Engine).

---

## 4. DevX & Automation (The New Developer Experience)

The Developer Experience (DevX) was streamlined into a centralized, resilient `Makefile` backed by a surgically pruned `scripts/` folder.

### 4.1 The Makefile
* Reconfigured to auto-detect `docker compose` variants and use BuildKit.
* Added `make doctor` to validate host dependencies, `.env` files, and ensure zero Prisma pollution.
* Added `make audit` to run containerized security and code quality checks.

### 4.2 The Scripts Arsenal
The `scripts/` directory was moved to the project root and refactored into four focused categories:
* **`db/`**: Contains `seed-control-plane.sh` (to inject the first test tenant into Mongo), `system-shell.sh`, `tenant-shell.sh`, and `reset.sh`.
* **`diagnostic/`**: Refactored `check_code_quality.sh`, `check_performance.sh`, and `check_rgpd.sh` to validate the new architectural rules (e.g., ensuring `IDatabaseAdapter` exists, verifying AES-256-GCM encryption, and checking for `isolated-vm`).
* **`security/`**: Streamlined to check for hardcoded secrets (`secrets.sh`) and validate HTTP headers (`headers.sh`).
* **`test/`**: Preserved and adapted `postman-cli.sh` for automated API contract testing against the dynamic endpoints.

---

## 5. Next Steps: Phase 0 Codebase Foundation

With the host environment, Docker infrastructure, and automation scripts perfectly aligned with the strategic vision, the infrastructure phase is complete.

The immediate next step is to write the foundational TypeScript contracts inside the `backend/src/common/` directory:

1.  **`schema.types.ts`:** Define `UniversalFieldType`, `FieldDefinition`, and `EntityDefinition`.
2.  **`query.types.ts`:** Define the `QueryIR` (Intermediate Representation) for AST translation.
3.  **`database-adapter.interface.ts`:** Define the strict contract that both `MongoAdapter` and `SqlAdapter` must implement.
4.  **NestJS Bootstrap:** Scaffold `main.ts`, `app.module.ts`, and the global `AllExceptionsFilter`.

Once these files are created, running `make typecheck` will yield zero errors, officially concluding Phase 0.