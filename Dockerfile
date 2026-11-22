# Multi-stage build - the builder stage has the full toolchain (TypeScript,
# @nestjs/cli, native build tools for bcrypt) needed to compile the app; the
# runtime stage only gets the compiled dist/ and production dependencies, so
# the final image is much smaller and doesn't carry devDependencies or a
# C++ compiler around. Pinning the Node version here (rather than relying on
# a platform default) is also the point of moving to Docker - Render's
# native build picked Node 24 with no warning, which is worth controlling
# directly.
FROM node:20-slim AS builder
WORKDIR /app

# bcrypt is a native addon - needs a C++ toolchain to build/rebuild against
# this image's Node ABI if no prebuilt binary matches.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Receipts are rendered to PDF by headless Chromium (see InvoiceService). The
# slim image has none of its shared libraries or any fonts, so install the
# distro's Chromium (which pulls in everything it needs) plus Liberation
# fonts - Liberation Mono is metric-compatible with Courier New, the
# receipt's typeface. Use that Chromium instead of letting puppeteer download
# its own, which would still be missing those libraries.
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && npm ci --omit=dev \
    && apt-get purge -y --auto-remove python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist

# Render (or whatever the deploy target is) supplies PORT at runtime - the
# app already reads process.env.PORT (src/configuration/index.ts), so no
# hardcoded EXPOSE value is load-bearing, just documentation.
EXPOSE 3000
CMD ["node", "dist/main"]
