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
APP_PID_FILE := .mini-baas-backend.pid
APP_LOG_FILE := .mini-baas-backend.log
PROJECT_PORTS := 3000 5432 $(MONGO_PORT) 6379

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

.PHONY: help all preflight check-docker check-ports free-ports bootstrap dev dev-bg stop-bg logs-bg turn-off clean

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
	@PORTS="$(PROJECT_PORTS)"; \
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

free-ports:
	$(call step,$(YELLOW)⚠,Freeing project ports and stopping related services...)
	@if [ -f "$(APP_PID_FILE)" ] && kill -0 $$(cat "$(APP_PID_FILE)") >/dev/null 2>&1; then \
		kill $$(cat "$(APP_PID_FILE)") >/dev/null 2>&1 || true; \
	fi
	@rm -f "$(APP_PID_FILE)"
	@$(COMPOSE_FILE) down 2>/dev/null || true
	@PORTS="$(PROJECT_PORTS)"; \
	for p in $$PORTS; do \
		PIDS=$$(lsof -t -iTCP:$$p -sTCP:LISTEN 2>/dev/null | sort -u); \
		if [ -n "$$PIDS" ]; then \
			echo -e "  $(YELLOW)⚠$(NC) Releasing port $(BOLD)$$p$(NC) (pid: $$PIDS)"; \
			kill $$PIDS >/dev/null 2>&1 || true; \
			sleep 1; \
			for pid in $$PIDS; do \
				kill -0 $$pid >/dev/null 2>&1 && kill -9 $$pid >/dev/null 2>&1 || true; \
			done; \
		fi; \
	done
	$(call step,$(GREEN)✓,Ports released)


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

dev-bg: preflight bootstrap
	$(call step,$(BLUE)ℹ,Initializing Backend Server in background...)
	@if [ -f "$(APP_PID_FILE)" ] && kill -0 $$(cat "$(APP_PID_FILE)") >/dev/null 2>&1; then \
		echo -e "  $(YELLOW)⚠$(NC) Backend already running (PID: $$(cat "$(APP_PID_FILE)"))"; \
		echo -e "  Logs → tail -f $(APP_LOG_FILE)"; \
		exit 0; \
	fi
	@nohup npm run start:dev > "$(APP_LOG_FILE)" 2>&1 & echo $$! > "$(APP_PID_FILE)"
	$(call step,$(GREEN)✓,Backend running in background)
	@echo -e "  Backend  → http://localhost:3000"
	@echo -e "  MongoDB  → mongodb://localhost:$(MONGO_PORT)"
	@echo -e "  PID file → $(APP_PID_FILE)"
	@echo -e "  Logs     → $(APP_LOG_FILE)"

stop-bg:
	$(call step,$(YELLOW)⚠,Stopping background backend and databases...)
	@if [ -f "$(APP_PID_FILE)" ] && kill -0 $$(cat "$(APP_PID_FILE)") >/dev/null 2>&1; then \
		kill $$(cat "$(APP_PID_FILE)") >/dev/null 2>&1 || true; \
		echo -e "  $(GREEN)✓$(NC) Backend stopped"; \
	else \
		echo -e "  $(YELLOW)⚠$(NC) Backend is not running"; \
	fi
	@rm -f "$(APP_PID_FILE)"
	@$(COMPOSE_FILE) down 2>/dev/null || true
	$(call step,$(GREEN)✓,Environment stopped)

logs-bg:
	@tail -f "$(APP_LOG_FILE)"

help:
	@echo ""
	@echo -e "$(BOLD)mini-baas — Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo -e "  $(YELLOW)⚠$(NC) $(BOLD)Note:$(NC) Run $(BOLD)make dev$(NC) for development mode. Use $(BOLD)make dev-bg$(NC) to run in background.$(NC)"
	@echo -e "  $(YELLOW)⚠$(NC) Use $(BOLD)make turn-off$(NC) or $(BOLD)make stop-bg$(NC) to stop the environment.$(NC)"
	@echo -e "  $(YELLOW)⚠$(NC) Use $(BOLD)make clean$(NC) to remove all containers, volumes, and networks.$(NC)"
	@echo -e "  $(YELLOW)⚠$(NC) Check the $(BOLD)Makefile$(NC) for more details on each command.$(NC)"
	@echo -e "  $(YELLOW)⚠$(NC) For any issues, please check the logs or open an issue on GitHub.$(NC)"
