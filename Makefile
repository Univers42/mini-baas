# ============================================
# mini-baas — MAKEFILE (App Factory)
# ============================================
# Usage: make <target>
# Run 'make help' to see all available targets
# ============================================

SHELL := /bin/bash
.SHELLFLAGS := -ec

# ── BuildKit auto-detection ──────────────────────────
BUILDX_AVAILABLE := $(shell docker buildx version >/dev/null 2>&1 && echo 1 || echo 0)
ifeq ($(BUILDX_AVAILABLE),1)
export DOCKER_BUILDKIT := 1
export COMPOSE_DOCKER_CLI_BUILD := 1
else
export DOCKER_BUILDKIT := 0
export COMPOSE_DOCKER_CLI_BUILD := 0
endif
.PHONY: help
.DEFAULT_GOAL := all

# ── Compose auto-detection ───────────────────────────
COMPOSE_CMD := $(shell \
	if docker compose version >/dev/null 2>&1; then echo 'docker compose'; \
	elif command -v docker-compose >/dev/null 2>&1; then echo 'docker-compose'; \
	elif command -v podman-compose >/dev/null 2>&1; then echo 'podman-compose'; \
	else echo '__NONE__'; fi \
)

# ── Variables ────────────────────────────────────────
COMPOSE_DEV  := $(COMPOSE_CMD) -f docker-compose.dev.yml
CONTAINER    := baas-api
BACKEND      := backend

# Colors
BLUE    := \033[0;34m
GREEN   := \033[0;32m
YELLOW  := \033[1;33m
RED     := \033[0;31m
CYAN    := \033[0;36m
NC      := \033[0m
BOLD    := \033[1m
DIM     := \033[2m

define BANNER
	@echo ""
	@echo -e "$(BLUE)╔══════════════════════════════════════════════════════════╗$(NC)"
	@echo -e "$(BLUE)║$(NC)  ⚙️  $(BOLD)mini-baas$(NC) — The Dynamic App Factory                 $(BLUE)║$(NC)"
	@echo -e "$(BLUE)╚══════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
endef

define step
	@echo -e "  $(1)  $(2)"
endef

# ============================================
#  🛡️ PREFLIGHT CHECKS
# ============================================

.PHONY: check-docker check-compose check-env preflight

check-docker:
	@command -v docker >/dev/null 2>&1 || { echo -e "$(RED)✗ Docker Engine not found$(NC)"; exit 1; }
	@docker info >/dev/null 2>&1 || { echo -e "$(RED)✗ Docker daemon is not running$(NC)"; exit 1; }
	$(call step,$(GREEN)✓,Docker Engine is running)

check-compose:
ifeq ($(COMPOSE_CMD),__NONE__)
	@echo -e "$(RED)✗ No Docker Compose tool found$(NC)" && exit 1
else
	$(call step,$(GREEN)✓,Compose tool: $(BOLD)$(COMPOSE_CMD)$(NC))
endif

check-env:
	@if [ ! -f .env ]; then \
		if [ -f .env.example ]; then \
			cp .env.example .env; \
			echo -e "  $(YELLOW)⚠$(NC)  .env created from .env.example. $(BOLD)Review it!$(NC)"; \
		else \
			echo -e "$(RED)✗ .env file missing$(NC)" && exit 1; \
		fi; \
	else \
		echo -e "  $(GREEN)✓$(NC)  .env file loaded"; \
	fi

check-ports:
	@PORTS="$${PORT:-3000} $${MONGO_PORT:-27017} $${POSTGRES_PORT:-5432} $${REDIS_PORT:-6379}"; \
	BLOCKED=""; \
	for p in $$PORTS; do \
		if ss -tlnp 2>/dev/null | grep -q ":$$p "; then BLOCKED="$$BLOCKED $$p"; fi; \
	done; \
	if [ -n "$$BLOCKED" ]; then \
		echo -e "  $(YELLOW)⚠$(NC)  Ports in use:$(BOLD)$$BLOCKED$(NC). Run $(BOLD)make kill-ports$(NC)"; \
	else \
		echo -e "  $(GREEN)✓$(NC)  All ports available"; \
	fi

preflight: check-docker check-compose check-env check-ports

# ============================================
#  ⚡ BOOTSTRAP & DOCKER
# ============================================

.PHONY: all banner bootstrap docker-up docker-down docker-logs docker-clean

all: banner preflight bootstrap dev  ## 🚀 Full setup (Docker only)

banner:
	$(BANNER)

bootstrap: docker-up install  ## 🐳 Start containers and install deps

docker-up: check-compose  ## 🐳 Start all containers (api, db, redis)
	$(call step,$(BLUE)ℹ,Starting containers...)
	@$(COMPOSE_DEV) up -d --build
	$(call step,$(GREEN)✓,Containers are running)

docker-down: check-compose  ## 🐳 Stop all containers
	@$(COMPOSE_DEV) down
	$(call step,$(GREEN)✓,Containers stopped)

docker-logs: check-compose  ## 🐳 Tail API container logs
	@$(COMPOSE_DEV) logs -f api

docker-clean: check-compose  ## 🐳 Remove containers + volumes (full reset)
	@echo -e "$(RED)⚠  This will delete ALL data (databases, cache)$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	@$(COMPOSE_DEV) down -v --remove-orphans
	$(call step,$(GREEN)✓,Full cleanup done)

# ============================================
#  📦 DEPENDENCIES & DEV
# ============================================

.PHONY: install dev shell

install:  ## 📦 Install backend dependencies
	$(call step,$(BLUE)ℹ,Installing backend dependencies...)
	@docker exec $(CONTAINER) pnpm install

dev:  ## 🚀 Start dev server (hot reload)
	$(call step,$(BLUE)ℹ,Starting dev server...)
	@echo -e "$(GREEN)  → API available at: http://localhost:$${PORT:-3000}/api$(NC)"
	@docker exec -it $(CONTAINER) sh -c "cd $(BACKEND) && pnpm run start:dev"

shell:  ## 🐚 Interactive shell in API container
	@docker exec -it $(CONTAINER) sh

# ============================================
#  ✅ QUALITY
# ============================================

.PHONY: lint format typecheck

lint:  ## ✅ Run ESLint
	@docker exec $(CONTAINER) pnpm exec eslint . 2>/dev/null || true

format:  ## ✅ Run Prettier
	@docker exec $(CONTAINER) pnpm exec prettier --write "src/**/*.ts"

typecheck:  ## ✅ TypeScript type checking
	@docker exec $(CONTAINER) pnpm exec tsc --noEmit

# ============================================
#  🔌 PORT MANAGEMENT & HELP
# ============================================

.PHONY: kill-ports help

kill-ports:  ## 🔌 Force kill processes on project ports
	@PORTS="$${PORT:-3000} $${MONGO_PORT:-27017} $${POSTGRES_PORT:-5432} $${REDIS_PORT:-6379}"; \
	for p in $$PORTS; do \
		PIDS=$$(ss -tlnp 2>/dev/null | grep ":$$p " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u); \
		if [ -n "$$PIDS" ]; then for pid in $$PIDS; do kill -9 $$pid 2>/dev/null || true; done; fi; \
	done
	@$(COMPOSE_DEV) down 2>/dev/null || true
	$(call step,$(GREEN)✓,Ports freed)

help:  ## ❓ Show this help message
	@echo -e "$(BOLD)mini-baas — Available Commands$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
