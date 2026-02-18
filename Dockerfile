FROM node:25-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_SITE_NAME="BirdNET Dashboard"
ARG VITE_SITE_TAGLINE=""
ARG VITE_SITE_SUBTITLE="BirdNET-Go"
ARG VITE_LOCALE="de"
ARG VITE_DEFAULT_THEME="system"
ARG VITE_BIRDNET_API_BASE_URL=""
ARG VITE_APP_VERSION=""

ENV VITE_SITE_NAME=$VITE_SITE_NAME \
    VITE_SITE_TAGLINE=$VITE_SITE_TAGLINE \
    VITE_SITE_SUBTITLE=$VITE_SITE_SUBTITLE \
    VITE_LOCALE=$VITE_LOCALE \
    VITE_DEFAULT_THEME=$VITE_DEFAULT_THEME \
    VITE_BIRDNET_API_BASE_URL=$VITE_BIRDNET_API_BASE_URL \
    VITE_APP_VERSION=$VITE_APP_VERSION

RUN npm run build

FROM nginx:alpine

RUN apk add --no-cache nodejs libcap \
    && setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx

WORKDIR /app

COPY docker/nginx.main.conf /etc/nginx/nginx.conf
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
COPY server /app/server
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh \
    && mkdir -p /cache /tmp/nginx /var/cache/nginx /etc/nginx/conf.d \
    && chown -R nginx:nginx /app /usr/share/nginx/html /etc/nginx/conf.d /cache /tmp/nginx /var/cache/nginx /start.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -T 4 -O - http://127.0.0.1/healthz >/dev/null || exit 1

USER nginx

CMD ["/start.sh"]
