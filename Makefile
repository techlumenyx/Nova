.PHONY: dev infra down logs compose-schema migrate codegen build typecheck

# ── Docker ────────────────────────────────────────────────────────────────────

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# prod: composes the supergraph schema then starts all services (no hot reload).
# The gateway uses the pre-built supergraph.graphql — rover does not run at startup.
prod:
	bash scripts/compose-schema.sh && docker compose up

infra:
	docker compose up postgres redis chromadb -d

down:
	docker compose down

logs:
	docker compose logs -f $(service)

# ── Schema ────────────────────────────────────────────────────────────────────

compose-schema:
	bash scripts/compose-schema.sh

# ── Database ──────────────────────────────────────────────────────────────────

migrate:
	bash scripts/migrate.sh

# ── Code Generation ───────────────────────────────────────────────────────────

codegen:
	npm run codegen --workspaces --if-present

# ── Build & Quality ───────────────────────────────────────────────────────────

build:
	npm run build --workspaces --if-present

typecheck:
	npm run typecheck --workspaces --if-present

lint:
	npm run lint

# ── Setup ─────────────────────────────────────────────────────────────────────

setup:
	bash scripts/dev-setup.sh
