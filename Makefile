SHELL := /bin/bash
.SHELLFLAGS := -ec

COMPOSE_CMD := $(shell \
	if docker compose version >/dev/null 2>&1; then \
		echo 'docker compose'; \
	elif command -v docker-compose >/dev/null 2>&1; then \
		echo 'docker-compose'; \
	else \
		echo '__NONE__'; \
	fi \
)

COMPOSE_FILE := $(COMPOSE_CMD) -f docker-compose.yml
MONGO_PORT ?= 27018
export MONGO_PORT

BLUE    := \033[0;34m
GREEN   := \033[0;32m
YELLOW  := \033[1;33m
RED     := \033[0;31m
NC      := \033[0m
BOLD    := \033[1m

define BANNER
	@echo ""
	@echo -e "$(BLUE)╔══════════════════════════════════════════════════════════╗$(NC)"
	@echo -e "$(BLUE)║$(NC)  ⚡  $(BOLD)mini-baas$(NC) — Dynamic Backend Platform                $(BLUE)║$(NC)"
	@echo -e "$(BLUE)╚══════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
endef

define step
	@echo -e "  $(1)  $(2)"
endef

.PHONY: help all preflight check-docker check-ports bootstrap dev turn-off clean

.DEFAULT_GOAL := all

all: banner preflight bootstrap dev

banner:
	$(BANNER)

preflight: check-docker check-ports
	$(call step,$(GREEN)✓,$(BOLD)Initial checks pass$(NC))

check-docker:
	@docker info >/dev/null 2>&1 || { \
		echo -e "$(RED)✗ Docker is not working. Please, open Docker Desktop.$(NC)"; \
		exit 1; \
	}
	$(call step,$(GREEN)✓,Docker Engine is working)

check-ports:
	@PORTS="3000 5432 $(MONGO_PORT) 6379"; \
	BLOCKED=""; \
	for p in $$PORTS; do \
		if ss -tlnp 2>/dev/null | grep -q ":$$p "; then \
			BLOCKED="$$BLOCKED $$p"; \
		elif lsof -Pi :$$p -sTCP:LISTEN -t >/dev/null 2>&1; then \
			BLOCKED="$$BLOCKED $$p"; \
		fi; \
	done; \
	if [ -n "$$BLOCKED" ]; then \
		echo -e "  $(YELLOW)⚠$(NC) Using port:$(BOLD)$$BLOCKED$(NC). Free them to continue."; \
		exit 1; \
	fi
	$(call step,$(GREEN)✓,Available ports)


bootstrap:
	$(call step,$(BLUE)ℹ,Initializing databases in Docker...)
	@$(COMPOSE_FILE) up -d || { \
		echo -e "$(YELLOW)⚠$(NC) Error while running containers. Check the above error."; \
		exit 1; \
	}
	$(call step,$(GREEN)✓,Databases are running)

turn-off:  
	$(call step,$(YELLOW)⚠,Shooting down databases...)
	@$(COMPOSE_FILE) down 2>/dev/null || true
	$(call step,$(GREEN)✓,All stoped)

clean: turn-off 
	@$(COMPOSE_FILE) down -v --remove-orphans 2>/dev/null || true
	$(call step,$(GREEN)✓,Clean environment)

dev: bootstrap
	$(call step,$(BLUE)ℹ,Initializing Backend Server...)
	@echo -e "  $(YELLOW)⚠$(NC) Press $(BOLD)Ctrl + C$(NC) ."
	@echo -e "  Backend  → http://localhost:3000"
	@echo -e "  MongoDB  → mongodb://localhost:$(MONGO_PORT)\n"
	@bash -c " \
		trap 'echo -e \"\n  $(YELLOW)⚠$(NC)  Getting signal. shooting down containers and freeing ports...\"; \
		$(COMPOSE_FILE) down 2>/dev/null || true; \
		echo -e \"  $(GREEN)✓$(NC) Clean environment\"' EXIT INT TERM; \
		npm run start:dev \
	"

help:
	@echo ""
	@echo -e "$(BOLD)mini-baas — Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
