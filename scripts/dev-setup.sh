#!/bin/bash
set -e

echo "Setting up Nova development environment..."

# 1. Copy .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — fill in your secrets before running."
fi

# 2. Install dependencies
echo "Installing npm dependencies..."
npm install

# 3. Generate Prisma clients
echo "Generating Prisma clients..."
for service in auth profile commerce chat content; do
  echo "  → $service"
  (cd services/$service && npx prisma generate)
done

echo ""
echo "Setup complete. Next steps:"
echo "  1. Edit .env with your secrets"
echo "  2. make infra        → start postgres, redis, chromadb"
echo "  3. make migrate      → run database migrations"
echo "  4. make dev          → start all services with hot reload"
