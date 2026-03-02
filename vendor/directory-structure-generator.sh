#!/usr/bin/env bash

if [ -z "$1" ]; then
  echo "Usage: $0 entity_name"
  exit 1
fi

ENTITY_NAME="$1"

# Check if nest is installed
if ! command -v nest -v &> /dev/null
then
    echo "Nest CLI could not be found."
    echo "Installing Nest CLI globally..."
    npm i -g @nestjs/cli
fi

cd ~/mini-baas/apps/backend

nest g resource "$ENTITY_NAME"
