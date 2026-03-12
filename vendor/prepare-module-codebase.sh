#!/bin/bash
# Script para generar la estructura de stubs de la Fase 0

cd app/src

# Arrays of modules grouped by their parent directory
declare -a CONTROL_PLANE_MODULES=("tenant" "metadata" "iam" "provisioner")
declare -a ENGINES_MODULES=("core" "sql" "nosql")
declare -a DATA_PLANE_MODULES=("dynamic-api" "validation" "transformation")
declare -a ROOT_MODULES=("auth" "session" "rbac" "audit" "gdpr" "mail" "notification" "newsletter" "files" "analytics" "webhook" "api-keys" "security" "runtime")

echo "Creating DDD directories and stubs..."

# 1. Control Plane
for mod in "${CONTROL_PLANE_MODULES[@]}"; do
    mkdir -p "modules/control-plane/$mod"
    echo -e "import { Module } from '@nestjs/common';\n\n@Module({})\nexport class ${mod^}Module {}" > "modules/control-plane/$mod/$mod.module.ts"
done

# 2. Engines
for mod in "${ENGINES_MODULES[@]}"; do
    mkdir -p "modules/engines/$mod"
    # No modules for these yet, just structure
done
echo -e "import { Module } from '@nestjs/common';\n\n@Module({})\nexport class EnginesModule {}" > "modules/engines/engines.module.ts"

# 3. Data Plane
for mod in "${DATA_PLANE_MODULES[@]}"; do
    mkdir -p "modules/data-plane/$mod"
    echo -e "import { Module } from '@nestjs/common';\n\n@Module({})\nexport class ${mod^}Module {}" > "modules/data-plane/$mod/$mod.module.ts"
done

# 4. Root Modules
for mod in "${ROOT_MODULES[@]}"; do
    mkdir -p "modules/$mod"
    if [ "$mod" != "runtime" ]; then
        # Handle kebab-case to PascalCase for module names
        className=$(echo "$mod" | awk -F- '{for(i=1;i<=NF;i++){$i=toupper(substr($i,1,1)) substr($i,2)}} 1' OFS="")
        echo -e "import { Module } from '@nestjs/common';\n\n@Module({})\nexport class ${className}Module {}" > "modules/$mod/$mod.module.ts"
    fi
done

# 5. Infrastructure
mkdir -p infrastructure/system-db infrastructure/cache
echo -e "import { Module } from '@nestjs/common';\n\n@Module({})\nexport class SystemDbModule {}" > infrastructure/system-db/system-db.module.ts
echo -e "import { Module } from '@nestjs/common';\n\n@Module({})\nexport class CacheModule {}" > infrastructure/cache/cache.module.ts

echo "✅ All directory stubs generated!"