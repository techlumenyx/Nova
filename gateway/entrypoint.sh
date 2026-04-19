#!/bin/bash
set -e

echo "[gateway] Starting entrypoint..."

LISTEN_PORT=${PORT:-4000}
echo "[gateway] Public port: ${LISTEN_PORT} (nginx) → 3000 (router graphql), 8088 (router health)"

if [ ! -f /config/supergraph.graphql ]; then
  echo "[gateway] supergraph.graphql not found — composing from subgraphs..."
  rover supergraph compose \
    --config /config/supergraph.yaml \
    --output /config/supergraph.graphql
  echo "[gateway] Supergraph composed."
else
  echo "[gateway] Using pre-built supergraph.graphql — skipping composition."
fi

# Generate nginx config with the dynamic PORT
cat > /etc/nginx/conf.d/gateway.conf << EOF
server {
    listen ${LISTEN_PORT};

    # Route health check to Apollo Router's health port
    location /.well-known/apollo/server-health {
        proxy_pass http://127.0.0.1:8088/.well-known/apollo/server-health;
        proxy_set_header Host \$host;
    }

    # Route everything else to Apollo Router's GraphQL port
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
EOF

# Remove default nginx site
rm -f /etc/nginx/sites-enabled/default

echo "[gateway] Starting nginx on port ${LISTEN_PORT}..."
nginx

echo "[gateway] Starting Apollo Router (GraphQL: 3000, Health: 8088)..."
exec router \
  --config /config/router.yaml \
  --supergraph /config/supergraph.graphql \
  --log info \
  "$@"
