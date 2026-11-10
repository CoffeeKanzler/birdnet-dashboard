FROM node:26-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS build

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

FROM nginx:alpine@sha256:713fc2ebfd92e8217db451477182ee91944b123d2b1ee9fd5a8c6e91ca6c3a11

RUN apk upgrade --no-cache \
    && apk add --no-cache nodejs \
    && rm -f /etc/nginx/conf.d/default.conf

WORKDIR /app
ENV NGINX_ENVSUBST_OUTPUT_DIR=/tmp/nginx/conf.d

COPY docker/nginx.main.conf /etc/nginx/nginx.conf
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY server /app/server
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh \
    && mkdir -p /cache /tmp/nginx/conf.d /var/cache/nginx \
    && chown -R nginx:nginx /app /usr/share/nginx/html /cache /tmp/nginx /var/cache/nginx /start.sh

EXPOSE 80 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -T 4 -O - http://127.0.0.1:8080/healthz >/dev/null || exit 1

USER nginx
CMD ["/start.sh"]
