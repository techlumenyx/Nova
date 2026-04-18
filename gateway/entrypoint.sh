#!/bin/bash
set -e

echo "[gateway] Starting entrypoint..."
echo "[gateway] PATH=$PATH"
echo "[gateway] Checking router binary..."
which router && router --version || echo "[gateway] ERROR: router not found"

echo "[gateway] Checking supergraph.graphql..."
if [ ! -f /config/supergraph.graphql ]; then
  echo "[gateway] supergraph.graphql not found — composing from subgraphs..."
  rover supergraph compose \
    --config /config/supergraph.yaml \
    --output /config/supergraph.graphql
  echo "[gateway] Supergraph composed."
else
  echo "[gateway] Using pre-built supergraph.graphql — skipping composition."
  ls -la /config/
fi

echo "[gateway] Validating router.yaml..."
cat /config/router.yaml

echo "[gateway] Starting Apollo Router..."
exec router \
  --config /config/router.yaml \
  --supergraph /config/supergraph.graphql \
  --log info \
  "$@"
