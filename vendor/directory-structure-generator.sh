#!/usr/bin/env bash

if [ -z "$1" ]; then
  echo "Usage: $0 entity_name"
  exit 1
fi

ENTITY_NAME="$1"

cd ~/mini-baas/vendor

echo "Creating directory structure for entity: $ENTITY_NAME"
mkdir -p "../apps/backend/src/${ENTITY_NAME}"
touch "../apps/backend/src/${ENTITY_NAME}/${ENTITY_NAME}.module.ts"
touch "../apps/backend/src/${ENTITY_NAME}/${ENTITY_NAME}.controller.ts"
touch "../apps/backend/src/${ENTITY_NAME}/${ENTITY_NAME}.service.ts"
touch "../apps/backend/src/${ENTITY_NAME}/${ENTITY_NAME}.gateway.ts"

mkdir -p "../apps/backend/src/${ENTITY_NAME}/dto"
touch "../apps/backend/src/${ENTITY_NAME}/dto/create-${ENTITY_NAME}.dto.ts"
touch "../apps/backend/src/${ENTITY_NAME}/dto/update-${ENTITY_NAME}.dto.ts"

mkdir -p "../apps/backend/src/${ENTITY_NAME}/entities"
touch "../apps/backend/src/${ENTITY_NAME}/entities/${ENTITY_NAME}.entity.ts"