#!/bin/bash
set -e

if [ ! -f /config/supergraph.graphql ]; then
  echo "[gateway] supergraph.graphql not found — composing from subgraphs..."
  rover supergraph compose \
    --config /config/supergraph.yaml \
    --output /config/supergraph.graphql
  echo "[gateway] Supergraph composed."
else
  echo "[gateway] Using pre-built supergraph.graphql — skipping composition."
fi

echo "[gateway] Starting Apollo Router..."
exec router \
  --config /config/router.yaml \
  --supergraph /config/supergraph.graphql \
  "$@"
