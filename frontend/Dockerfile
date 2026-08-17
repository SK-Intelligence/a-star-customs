FROM node:20-alpine AS build

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace frontend

COPY frontend ./frontend
RUN npm run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/proxy_params /etc/nginx/proxy_params
COPY --from=build /workspace/frontend/dist /usr/share/nginx/html

EXPOSE 80
