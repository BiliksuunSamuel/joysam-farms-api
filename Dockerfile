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
