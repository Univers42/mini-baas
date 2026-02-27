# mini-baas — Setup & Architecture Documentation

This document outlines the initial setup, infrastructure, and architectural decisions for the `mini-baas` project. 

> **Goal:** To establish a self-adapting, database-agnostic backend platform capable of transforming itself at runtime based on tenant metadata.

---

## 1. Prerequisites

To run this environment locally, the host machine strictly requires:
* **Node.js** (v18 or LTS) & **npm**: For running the NestJS application locally.
* **Docker Desktop / Docker Engine**: For running the containerized databases (PostgreSQL, MongoDB, Redis).
* **GNU Make**: For environment automation.

---

## 2. Domain-Driven Project Structure

The codebase follows a Domain-Driven Design (DDD) approach to ensure modularity and scalability. All community and GitHub-related files have been moved to `.github/` to keep the root directory clean.

```text
mini-baas/
├── .github/                        # Community guidelines, Code of Conduct, Security policies
├── src/                            # Source code (NestJS)
│   ├── common/                     # Shared resources across all modules
│   │   ├── interfaces/             # Universal contracts (e.g., IDatabaseAdapter)
│   │   ├── filters/                # Global exception handlers
│   │   └── utils/                  # Helper functions
│   ├── modules/                    # Isolated feature modules
│   │   ├── database/               # The dynamic DatabaseProvider factory
│   │   ├── dynamic-api/            # The single, dynamic controller & service
│   │   ├── engines/                # Concrete database adapters (SQL, NoSQL)
│   │   ├── hooks/                  # Sandboxed execution environment for user logic
│   │   ├── schema/                 # Database introspection and metadata mapping
│   │   └── tenant/                 # Multi-tenant identification and configuration
│   ├── app.module.ts               # Root application module
│   └── main.ts                     # Application entry point
├── docker-compose.yml              # Containerized infrastructure definition
├── Makefile                        # Automation scripts and CLI tool
└── .env / .env.example             # Environment variables (Credentials) 
```
## 3. Containerized Infrastructure


We do not install databases directly on the host machine. Instead, we use `docker-compose.yml` to spin up isolated containers for our dual-engine architecture.

### The infrastructure includes:
* **PostgreSQL (Port 5432):** The primary SQL engine for tenants requiring relational data integrity.
* **MongoDB (Port 27017):** The primary NoSQL engine for high flexibility, and the system's internal database for storing schema metadata.
* **Redis (Port 6379):** In-memory data store for caching and background job queues (e.g., BullMQ).

> **Note:** Persistent volumes (`pgdata`, `mongodata`, `redisdata`) are configured to prevent data loss between container restarts.

---

## 4. Automation & Graceful Shutdown (Makefile)

The `Makefile` serves as the control panel for the developer experience. The default target (`make dev`) completely automates the bootstrap process.

### Key Features of `make dev`:
* **Preflight Checks:** Automatically verifies that the Docker Engine is running and that required ports (`3000`, `5432`, `27017`, `6379`) are available.
* **Bootstrapping:** Deploys the Docker Compose stack in detached mode (`-d`).
* **Graceful Shutdown (Trap):** Wraps the local `npm run start:dev` process in a Bash trap. Upon receiving a `SIGINT` (Ctrl+C), it safely terminates the Node.js server, runs `docker compose down` to kill orphaned containers, and frees all ports automatically.

### Available Commands:
* `make` / `make dev` : Starts the databases and the NestJS server.
* `make clean` : Tears down the containers and destroys persistent volumes (full reset).