FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY . .

# Django `/admin/` statik fayllari image ichiga yig'iladi (WhiteNoise beradi). Build vaqtida haqiqiy
# sirlar kerak emas: faqat settings import bo'lishi uchun soxta qiymatlar.
RUN SECRET_KEY=build-only DATABASE_URL=sqlite:////tmp/build.db DJANGO_SETTINGS_MODULE=config.settings.prod     python manage.py collectstatic --noinput

EXPOSE 8000

# Prod (Railway): gunicorn. Dev'da docker-compose `command` bilan runserver ishlatiladi.
# Worker servisi `celery -A config worker -l info` bilan (Start Command) almashtiradi.
CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --timeout 60 --access-logfile -"]
