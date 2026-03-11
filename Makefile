# ============================================
# mini-baas — MAKEFILE (App Factory Edition)
# ============================================
# Usage: make <target>
# Run 'make help' to see all available targets
#
# 🐳 FULLY CONTAINERIZED: Only Docker required!
# 🛡️ RESILIENT: Auto-detects docker compose v2 / v1 / podman
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
	if docker compose version >/dev/null 2>&1; then \
		echo 'docker compose'; \
	elif command -v docker-compose >/dev/null 2>&1; then \
		echo 'docker-compose'; \
	elif command -v podman-compose >/dev/null 2>&1; then \
		echo 'podman-compose'; \
	else \
		echo '__NONE__'; \
	fi \
)

COMPOSE_VERSION := $(shell \
	if docker compose version --short 2>/dev/null; then true; \
	elif docker-compose version --short 2>/dev/null; then true; \
	elif podman-compose version 2>/dev/null | grep -oP '[\d]+\.[\d]+' | head -1; then true; \
	else echo 'unknown'; \
	fi \
)

# ── Variables ────────────────────────────────────────
COMPOSE_DEV  := $(COMPOSE_CMD) -f docker-compose.dev.yml
CONTAINER    := baas-dev-engine # Updated container name
BACKEND      := backend         # Updated to the new clean folder

# Colors
BLUE    := \033[0;34m
GREEN   := \033[0;32m
YELLOW  := \033[1;33m
RED     := \033[0;31m
CYAN    := \033[0;36m
NC      := \033[0m
BOLD    := \033[1m
DIM     := \033[2m

# Box drawing
define BANNER
	@echo ""
	@echo -e "$(BLUE)╔══════════════════════════════════════════════════════════╗$(NC)"
	@echo -e "$(BLUE)║$(NC)  ⚙️   $(BOLD)mini-baas$(NC) — The Polyglot App Factory              $(BLUE)║$(NC)"
	@echo -e "$(BLUE)╚══════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
endef

# ── Step decorator ───────────────────────────────────
define step
	@echo -e "  $(1)  $(2)"
endef

# ============================================
#  🛡️ PREFLIGHT CHECKS
# ============================================

.PHONY: check-docker check-compose check-env check-ports preflight

check-docker:
	@command -v docker >/dev/null 2>&1 || { echo -e "$(RED)✗ Docker Engine not found$(NC)"; exit 1; }
	@docker info >/dev/null 2>&1 || { echo -e "$(RED)✗ Docker daemon is not running$(NC)"; exit 1; }
	$(call step,$(GREEN)✓,Docker Engine is running)

check-compose:
ifeq ($(COMPOSE_CMD),__NONE__)
	@echo -e "$(RED)✗ No Docker Compose tool found$(NC)"
	@exit 1
else
	$(call step,$(GREEN)✓,Compose tool: $(BOLD)$(COMPOSE_CMD)$(NC))
endif

check-env:
	@if [ ! -f $(BACKEND)/.env ]; then \
		if [ -f $(BACKEND)/.env.example ]; then \
			echo -e "  $(YELLOW)⚠$(NC)  .env not found — creating from .env.example"; \
			cp $(BACKEND)/.env.example $(BACKEND)/.env; \
		else \
			echo -e "$(RED)✗ .env file is missing in $(BACKEND)/$(NC)"; \
			exit 1; \
		fi; \
	else \
		echo -e "  $(GREEN)✓$(NC)  .env file loaded"; \
	fi

check-ports:
	@PORTS="3000 27017 5432 6379"; \
	BLOCKED=""; \
	for p in $$PORTS; do \
		if ss -tlnp 2>/dev/null | grep -q ":$$p "; then \
			BLOCKED="$$BLOCKED $$p"; \
		fi; \
	done; \
	if [ -n "$$BLOCKED" ]; then \
		echo -e "  $(YELLOW)⚠$(NC)  Ports in use:$(BOLD)$$BLOCKED$(NC) (run 'make kill-ports')"; \
	else \
		echo -e "  $(GREEN)✓$(NC)  All ports available"; \
	fi

preflight: check-docker check-compose check-env check-ports
	$(call step,$(GREEN)✓,$(BOLD)Preflight checks passed$(NC))

# ============================================
#  ⚡ BOOTSTRAP
# ============================================

.PHONY: all bootstrap banner

all: banner preflight bootstrap dev

banner:
	$(BANNER)

bootstrap: docker-up install typecheck
	@echo ""
	@echo -e "$(GREEN)╔══════════════════════════════════════════════════════════╗$(NC)"
	@echo -e "$(GREEN)║$(NC)  ✅  $(BOLD)Engine setup complete!$(NC)                            $(GREEN)║$(NC)"
	@echo -e "$(GREEN)╠══════════════════════════════════════════════════════════╣$(NC)"
	@echo -e "$(GREEN)║$(NC)  BaaS API →  http://localhost:3000/health                 $(GREEN)║$(NC)"
	@echo -e "$(GREEN)║$(NC)  Swagger  →  http://localhost:3000/docs                   $(GREEN)║$(NC)"
	@echo -e "$(GREEN)╚══════════════════════════════════════════════════════════╝$(NC)"
	@echo ""

# ============================================
#  🐳 DOCKER
# ============================================

.PHONY: docker-up docker-down docker-logs docker-clean

docker-up: check-compose
	$(call step,$(BLUE)ℹ,Starting Engine containers...)
	@$(COMPOSE_DEV) up -d --build

docker-down: check-compose
	$(call step,$(YELLOW)⚠,Stopping Engine...)
	@$(COMPOSE_DEV) down

docker-logs: check-compose
	@$(COMPOSE_DEV) logs -f

docker-clean: check-compose
	@echo -e "$(RED)⚠  This will delete all databases and node_modules$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	@$(COMPOSE_DEV) down -v --remove-orphans
	@rm -rf $(BACKEND)/node_modules $(BACKEND)/dist
	$(call step,$(GREEN)✓,Full cleanup done)

# ============================================
#  📦 DEPENDENCIES & DEV
# ============================================

.PHONY: install dev shell

install:
	$(call step,$(BLUE)ℹ,Installing BaaS dependencies...)
	@docker exec $(CONTAINER) sh -c "cd /app && pnpm install"

dev: docker-up
	$(call step,$(BLUE)ℹ,Starting hot-reload engine...)
	@docker exec -it $(CONTAINER) sh -c "cd /app && pnpm run start:dev"

shell:
	@docker exec -it $(CONTAINER) bash

# ============================================
#  ✅ QUALITY & PHASE 0 CHECKS
# ============================================

.PHONY: lint format typecheck

lint:
	$(call step,$(BLUE)ℹ,Running ESLint...)
	@docker exec $(CONTAINER) sh -c "cd /app && pnpm exec eslint . 2>/dev/null || true"

format:
	$(call step,$(BLUE)ℹ,Running Prettier...)
	@docker exec $(CONTAINER) sh -c "cd /app && pnpm exec prettier --write 'src/**/*.ts'"

typecheck:
	$(call step,$(BLUE)ℹ,Verifying Phase 0 Structure (tsc --noEmit)...)
	@docker exec $(CONTAINER) sh -c "cd /app && pnpm exec tsc --noEmit"
	$(call step,$(GREEN)✓,Phase 0 compilation passed!)

# ============================================
#  🔌 PORT MANAGEMENT
# ============================================

.PHONY: kill-ports

kill-ports:
	$(call step,$(YELLOW)⚠,Freeing ports...)
	@$(COMPOSE_DEV) down 2>/dev/null || true
	@for p in 3000 27017 5432 6379; do \
		PIDS=$$(lsof -t -i :$$p 2>/dev/null); \
		if [ -n "$$PIDS" ]; then kill -9 $$PIDS 2>/dev/null || sudo kill -9 $$PIDS 2>/dev/null || true; fi; \
	done
	$(call step,$(GREEN)✓,Ports freed)

# ============================================
#  ❓ HELP
# ============================================

help:
	@echo -e "$(BOLD)mini-baas — Available Commands$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
