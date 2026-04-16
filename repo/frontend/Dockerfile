# ── Stage 1: builder ────────────────────────────────────────
FROM node:20 AS builder
WORKDIR /app

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install

# Copy only source files — NOT nginx.conf, so config changes don't bust this cache
COPY src ./src
COPY index.html ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY postcss.config.js ./
COPY tailwind.config.ts ./
COPY components.json ./

RUN npm run build

# ── Stage 2: production (nginx) ─────────────────────────────
FROM nginx:alpine AS production
RUN apk add --no-cache wget
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ── Stage 3: test (vitest unit + Playwright e2e) ────────────
FROM builder AS test
RUN apt-get update && apt-get install -y --no-install-recommends chromium && rm -rf /var/lib/apt/lists/*
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
RUN npm install --no-save @vitest/coverage-v8@^1.4.0 @playwright/test@^1.44.0
COPY tests ./tests
COPY playwright.config.ts ./
CMD ["sh", "-c", "npx vitest run --coverage && npx playwright test --reporter=list"]
