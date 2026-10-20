.PHONY: dev test lint migrate schema types e2e smoke

HAS_BACKEND := $(wildcard backend/manage.py)
NO_BACKEND = @echo "backend hali sozlanmagan (backend/manage.py yo'q) — bu qadam o'tkazib yuborildi."

# Postgres, Redis, backend va worker'ni docker compose'da ko'taradi, so'ng frontend dev server.
dev:
ifdef HAS_BACKEND
	docker compose up -d --build
else
	$(NO_BACKEND)
endif
	cd frontend && npm run dev

test:
ifdef HAS_BACKEND
	docker compose up -d --wait postgres
	cd backend && uv run pytest
else
	$(NO_BACKEND)
endif
	cd frontend && npm run typecheck && npm test

lint:
ifdef HAS_BACKEND
	cd backend && uv run ruff check . && uv run ruff format --check .
else
	$(NO_BACKEND)
endif
	cd frontend && npm run lint

migrate:
ifdef HAS_BACKEND
	docker compose exec backend python manage.py migrate
else
	$(NO_BACKEND)
endif

# backend/openapi.yaml ni yangilaydi
schema:
ifdef HAS_BACKEND
	cd backend && uv run python manage.py spectacular --file openapi.yaml --validate
else
	$(NO_BACKEND)
endif

# frontend/src/lib/api/schema.ts ni openapi.yaml dan generatsiya qiladi
types:
ifneq ($(wildcard backend/openapi.yaml),)
	cd frontend && npm run api:types
else
	@echo "backend/openapi.yaml hali yo'q — tiplar generatsiya qilinmadi."
endif

# Playwright e2e: compose backend + frontend production build (yangi auth oqimi bilan).
e2e:
	docker compose up -d --wait
	cd frontend && npx playwright test

# Ishlab turgan stack (make dev) ni tekshiradi: backend /health/ va /dev/api-status.
smoke:
	cd frontend && npm run smoke
