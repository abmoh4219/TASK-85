# Stage 1: build — use Debian-based node to avoid Alpine/musl npm crash
FROM node:20 AS builder

WORKDIR /app

# API calls go through nginx proxy at /api
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: serve with nginx + TLS
FROM nginx:alpine AS production

# Generate self-signed TLS certificate for LAN/dev use
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/certs && \
    openssl req -x509 -nodes -days 365 \
      -newkey rsa:2048 \
      -keyout /etc/nginx/certs/selfsigned.key \
      -out /etc/nginx/certs/selfsigned.crt \
      -subj "/C=US/ST=Local/L=Local/O=MeridianMed/CN=localhost" && \
    apk del openssl

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 443 80

CMD ["nginx", "-g", "daemon off;"]
