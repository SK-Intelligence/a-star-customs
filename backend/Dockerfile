FROM python:3.12-slim AS catalog-check

WORKDIR /workspace
COPY scripts/check_catalog_sync.py scripts/media-review.json ./scripts/
COPY frontend/src/data/catalog.json frontend/src/data/add-ons.json ./frontend/src/data/
COPY backend/app/catalog.json backend/app/add-ons.json ./backend/app/
COPY frontend/public ./frontend/public
RUN python scripts/check_catalog_sync.py && touch /catalog-check-passed

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ORDERS_DATABASE_PATH=/data/orders.db \
    REVIEWS_DATABASE_PATH=/data/reviews.db

WORKDIR /app

COPY backend/requirements-runtime.txt ./requirements-runtime.txt
RUN pip install --no-cache-dir -r requirements-runtime.txt \
    && useradd --uid 10001 --create-home --shell /usr/sbin/nologin appuser

COPY --chown=appuser:appuser backend/app ./app
COPY --from=catalog-check /catalog-check-passed /tmp/catalog-check-passed
RUN mkdir -p /data && chown appuser:appuser /data

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\" --proxy-headers"]
