# Stage 1: builder — Debian node avoids Alpine/musl npm crash
FROM node:20 AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src

RUN npm run build

# Prune to production deps only (still on Debian, no crash)
RUN npm prune --omit=dev

# Stage 2: production (alpine for small image, only needs the pruned node_modules)
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache wget

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/main.js"]
