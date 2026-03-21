#!/bin/bash
set -e

echo "Composing supergraph schema from subgraphs..."

rover supergraph compose \
  --config gateway/supergraph.yaml \
  --output gateway/supergraph.graphql

echo "Done → gateway/supergraph.graphql"
