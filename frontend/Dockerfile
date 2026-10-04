# Base images are pinned by digest (the tag documents it); Dependabot proposes updates.
FROM python:3.12.15-alpine@sha256:1b668429b3511ab407d8e00648891631b0b1a4d7e15e3ca70f38ab5b91ad4ab4 AS catalog-check

WORKDIR /workspace
COPY scripts/check_catalog_sync.py scripts/media-review.json scripts/generic-add-on-approvals.json ./scripts/
COPY frontend/src/data/catalog.json frontend/src/data/add-ons.json ./frontend/src/data/
COPY backend/app/catalog.json backend/app/add-ons.json ./backend/app/
COPY frontend/public ./frontend/public
RUN python scripts/check_catalog_sync.py && touch /catalog-check-passed

FROM node:22.23.3-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace frontend

COPY frontend ./frontend
COPY --from=catalog-check /catalog-check-passed /tmp/catalog-check-passed
RUN npm run build

# nginx stable line.
FROM nginx:1.30.5-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94
ENV BACKEND_HOST=backend \
    NGINX_RESOLVER=127.0.0.11 \
    NGINX_ENVSUBST_FILTER="BACKEND_HOST|NGINX_RESOLVER"
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY frontend/proxy_params /etc/nginx/proxy_params
COPY --from=build /workspace/frontend/dist /usr/share/nginx/html

EXPOSE 80
