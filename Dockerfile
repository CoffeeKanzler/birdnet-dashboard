FROM node:24-alpine AS build

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

COPY docker/nginx.main.conf /etc/nginx/nginx.conf
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
