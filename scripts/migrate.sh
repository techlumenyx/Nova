#!/bin/bash
set -e

SERVICES=("auth" "profile" "commerce" "chat" "content")

for service in "${SERVICES[@]}"; do
  echo "Running migrations for $service..."
  docker compose exec "$service" npx prisma migrate deploy \
    --schema /app/services/"$service"/prisma/schema.prisma
done

echo "All migrations complete."
