# mini-baas — Infrastructure Checkpoint: The Great Purge & Rebirth

> **Date:** March 2026  
> **Phase:** Phase 0 (Infrastructure, DevX & Codebase Foundation)  
> **Status:** 100% Completed  

## 1. Executive Summary

Before writing the first line of TypeScript for the `mini-baas` engine, it was mandatory to sever all ties with the legacy static architecture (the "Vite Gourmand" monorepo). 

The legacy environment was tightly coupled to **Prisma** (static schemas), **Frontend SPA serving** (Nginx), and **hardcoded business logic**. We have successfully dismantled this legacy infrastructure and laid down a clean, optimized, and strictly governed environment tailored for the **Polyglot App Factory**.

This document serves as a checkpoint summarizing the infrastructure changes, the structural migration from `backend/` to `app/`, and the foundational codebase established to conclude the Phase 0 roadmap.

---

## 2. The Great Purge (What We Removed)

To enforce the *Zero Business Logic Awareness* principle, we systematically removed components that violated the dynamic nature of a BaaS:

1.  **The Monorepo Illusion:** Deleted the root `package.json`, `pnpm-lock.yaml`, and the `packages/shared/` directory. `mini-baas` is a standalone, headless backend engine, not a full-stack workspace. The core source code now lives exclusively in the `app/` directory.
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
* **`baas-dev-engine` (Node.js 22):** The NestJS runtime, mapping its volume securely to the pristine `app/` directory.

### 3.2 The Polyglot Package (`app/package.json`)
Created a fresh, strict package configuration for the backend engine, perfectly aligned with NestJS 11:
* **Adapters:** `knex`, `mongodb`, `mongoose`.
* **Validation Engine:** `ajv`, `ajv-formats`, `class-validator`, and `class-transformer` (required for strict runtime payload sanitization).
* **Security & Auth:** `@casl/ability` (ABAC Policy Engine), `@nestjs/swagger` (v11 compliant).

---

## 4. DevX & Automation (The New Developer Experience)

The Developer Experience (DevX) was streamlined into a centralized, resilient `Makefile` backed by a surgically pruned `scripts/` folder.

### 4.1 The Scripts Arsenal
The `scripts/` directory was refactored into focused categories:
* **`db/`**: `seed-control-plane.sh`, `system-shell.sh`, `tenant-shell.sh`, and `reset.sh`.
* **`diagnostic/`**: Validates new architectural rules (ensuring `IDatabaseAdapter` exists, verifying AES-256-GCM encryption, etc.).
* **`security/`**: Checks for hardcoded secrets (`secrets.sh`) and validates HTTP headers (`headers.sh`).
* **`utils/`**: Features `doctor.sh` to validate host dependencies, path bindings (`app/`), and ensure zero Prisma pollution.

---

## 5. Codebase Foundation (Domain-Driven Design)

With the infrastructure running, the core TypeScript structure was scaffolded inside the `app/src/` directory to adhere strictly to Domain-Driven Design (DDD).

1.  **Strict Directory Mapping:** Generated 37 modular directories divided by architectural boundaries (`control-plane`, `data-plane`, `engines`, and functional root modules).
2.  **Module Stubs:** Every future feature (Audit, GDPR, Auth, Webhooks) was given an empty `*.module.ts` stub (e.g., `DynamicApiModule`, `ApiKeysModule`) to map the territory without implementing premature logic.
3.  **Environment Contracts:** Defined `app/.env.example` mapping crucial ports, secrets, and the `MASTER_ENCRYPTION_KEY` requirement.
4.  **Health Check:** Implemented `health.controller.ts` to allow Docker to accurately report the engine's lifecycle status.
5.  **Git Hygiene:** Established a bulletproof `.gitignore` to prevent compiled NestJS artifacts (`app/dist/`) and `node_modules/` from polluting the repository.

---

## 6. Architectural Wiring: How the Core Connects

The most critical deliverable of Phase 0 is the foundational wiring. By designing these core contracts upfront, we ensure that the rest of the application remains decoupled, secure, and truly polyglot.



### 6.1 The Gatekeeper (`main.ts` & `app.module.ts`)
* **`app.module.ts` (The Registry):** Acts as the root tree of the application. It initializes environment variables globally via `ConfigModule` and exposes the `HealthController`. In future phases, it will be the *only* place where planes and modules are stitched together.
* **`main.ts` (The Armor):** Bootstraps the Express/NestJS server and immediately applies global security policies:
    * `helmet()`: Injects strict HTTP security headers.
    * `compression()`: Optimizes bandwidth.
    * `ValidationPipe`: Strips out malicious or unexpected payload data before it reaches the business logic (`whitelist: true`, `forbidNonWhitelisted: true`, powered by `class-validator`).

### 6.2 The Anti-Leak Shield (`AllExceptionsFilter`)
Information Disclosure (leaking stack traces) is a critical security vulnerability. 
* The `common/exceptions/all-exceptions.filter.ts` catches *every* unhandled error in the system.
* If an internal process fails (e.g., database connection drops), it masks the error to the client, returning a generic `500 Internal Server Error` standard JSON response.
* The actual error, stack trace, and context are securely logged internally for developer debugging. This guarantees GDPR and general security compliance from day one.

### 6.3 The Polyglot Triad (`common/types/` & `common/interfaces/`)
To achieve true database agnosticism, the system requires a universal language. This is defined by three files:

1.  **The Type Dictionary (`schema.types.ts`):** Defines `UniversalFieldType` (e.g., `string`, `decimal`, `datetime`). Because Postgres calls a string `VARCHAR` and Mongo calls it `String`, the tenant's Master Document only uses universal types. The underlying engine adapter translates them.
2.  **The Query Language (`query.types.ts`):** Defines `QueryIR` (Intermediate Representation). Instead of writing raw SQL or Mongo aggregation pipelines in our controllers, the application constructs a standardized JSON query object (`{ where: { status: 'active' }, limit: 10 }`).
3.  **The Universal Contract (`database-adapter.interface.ts`):** The crown jewel of the architecture. It is an interface that dictates exactly what methods a database engine must implement (CRUD operations, schema introspection, and collection provisioning). Whether the backend is talking to the `SqlAdapter` or the `MongoAdapter`, the method signature is identical.

---

## 7. Developer Experience (DevX): The Makefile Guide

The `Makefile` has been upgraded to an interactive, 42-school-inspired CLI tool. It encapsulates complex Docker and pnpm commands into simple, memorable instructions.

### 7.1 The Interactive Help Menu
Instead of a wall of text, the Makefile features dynamic pattern rules:
* `make help`: Shows a categorized index of commands.
* `make help-<category>`: Filters commands by category (e.g., `make help-docker`).
* `make help-all`: Displays the entire dictionary of commands.

### 7.2 The Daily Workflow
When sitting down to code, follow this routine:

1.  **Start the Engine:**
    ```bash
    make dev
    ```
    *What it does:* Starts MongoDB, Postgres, and Redis in the background, then boots the NestJS engine in interactive watch mode. Code changes will trigger hot-reloads automatically.

2.  **Stop the Engine (Graceful Shutdown):**
    Press `Ctrl + C` in the terminal where `make dev` is running, then execute:
    ```bash
    make docker-down
    ```

### 7.3 Code Quality & Compilation
While `make dev` is running in one terminal, use a second terminal to run checks:
* **`make typecheck`**: Runs the TypeScript compiler in "dry-run" mode (`tsc --noEmit`). The ultimate source of truth.
* **`make lint`**: Runs ESLint to catch bad practices.
* **`make format`**: Runs Prettier to auto-format all code.

### 7.4 Diagnostics & Cleanup (42 Style)
* **`make doctor`**: Analyzes the host machine, verifies that `.env` files are present in `app/`, and ensures zero legacy pollution.
* **`make clean`**: Removes local build artifacts (e.g., `app/dist/`).
* **`make fclean`**: The Deep Wipe. Removes artifacts, destroys all Docker containers, tears down database volumes (data is lost), and deletes `node_modules/`.
* **`make re`**: The Rebirth. Executes an `fclean` followed by a full `bootstrap` and `dev` server start.