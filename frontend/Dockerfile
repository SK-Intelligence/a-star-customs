FROM python:3.12-alpine AS catalog-check

WORKDIR /workspace
COPY scripts/check_catalog_sync.py scripts/media-review.json ./scripts/
COPY frontend/src/data/catalog.json frontend/src/data/add-ons.json ./frontend/src/data/
COPY backend/app/catalog.json backend/app/add-ons.json ./backend/app/
COPY frontend/public ./frontend/public
RUN python scripts/check_catalog_sync.py && touch /catalog-check-passed

FROM node:20-alpine AS build

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace frontend

COPY frontend ./frontend
COPY --from=catalog-check /catalog-check-passed /tmp/catalog-check-passed
RUN npm run build

FROM nginx:1.27-alpine
ENV BACKEND_HOST=backend \
    NGINX_RESOLVER=127.0.0.11 \
    NGINX_ENVSUBST_FILTER="BACKEND_HOST|NGINX_RESOLVER"
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY frontend/proxy_params /etc/nginx/proxy_params
COPY --from=build /workspace/frontend/dist /usr/share/nginx/html

EXPOSE 80
