#!/bin/bash
set -e

echo "[gateway] Starting entrypoint..."
echo "[gateway] PORT=${PORT:-4000}"

LISTEN_PORT=${PORT:-4000}

if [ ! -f /config/supergraph.graphql ]; then
  echo "[gateway] supergraph.graphql not found — composing from subgraphs..."
  rover supergraph compose \
    --config /config/supergraph.yaml \
    --output /config/supergraph.graphql
  echo "[gateway] Supergraph composed."
else
  echo "[gateway] Using pre-built supergraph.graphql — skipping composition."
fi

echo "[gateway] Starting Apollo Router on port ${LISTEN_PORT}..."
exec router \
  --config /config/router.yaml \
  --supergraph /config/supergraph.graphql \
  --listen "0.0.0.0:${LISTEN_PORT}" \
  --log info \
  "$@"
