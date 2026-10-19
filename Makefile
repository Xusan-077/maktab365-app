.PHONY: dev test lint schema types e2e

HAS_BACKEND := $(wildcard backend/manage.py)
NO_BACKEND = @echo "backend hali sozlanmagan (backend/manage.py yo'q) — bu qadam o'tkazib yuborildi."

dev:
ifdef HAS_BACKEND
	docker compose up -d
else
	$(NO_BACKEND)
endif
	cd frontend && npm run dev

test:
ifdef HAS_BACKEND
	cd backend && pytest
else
	$(NO_BACKEND)
endif
	cd frontend && npm run typecheck && npm test

lint:
ifdef HAS_BACKEND
	cd backend && ruff check . && ruff format --check .
else
	$(NO_BACKEND)
endif
	cd frontend && npm run lint

# backend/openapi.yaml ni yangilaydi
schema:
ifdef HAS_BACKEND
	cd backend && python manage.py spectacular --file openapi.yaml --validate
else
	$(NO_BACKEND)
endif

# frontend/src/lib/api/schema.ts ni openapi.yaml dan generatsiya qiladi
types:
ifneq ($(wildcard backend/openapi.yaml),)
	cd frontend && npx openapi-typescript ../backend/openapi.yaml -o src/lib/api/schema.ts
else
	@echo "backend/openapi.yaml hali yo'q — tiplar generatsiya qilinmadi."
endif

e2e:
ifdef HAS_BACKEND
	cd frontend && npm run e2e
else
	$(NO_BACKEND)
endif
