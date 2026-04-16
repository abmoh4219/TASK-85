# ── Stage 1: builder ────────────────────────────────────────
FROM node:20 AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src

RUN npm run build

# ── Stage 2: test (has devDeps — branches before prune) ────
FROM builder AS test
COPY tests ./tests
CMD ["sh", "-c", "npx jest --testPathPattern='tests/unit_tests/.*\\.spec\\.ts$' --coverage --forceExit --ci && npx jest --config ./tests/api_tests/jest-e2e.json --coverage --runInBand --forceExit --ci"]

# ── Stage 3: pruned (Debian — safe for native modules) ─────
FROM builder AS pruned
RUN npm prune --omit=dev

# ── Stage 4: production ────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache wget
COPY --from=pruned /app/node_modules ./node_modules
COPY --from=pruned /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/main.js"]
