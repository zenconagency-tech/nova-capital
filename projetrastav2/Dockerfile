# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile.  Used by Fly.io / Railway / Render (Docker env).
# Not strictly required for Render's native Node environment — Render will
# run `npm install` + `npm start` directly.  This file is here for
# flexibility and gives you a deterministic production image.
#
# Build:    docker build -t nova-capital .
# Run:      docker run -p 3000:3000 --env-file .env nova-capital

# ---------- 1. deps (with devDeps for any build steps) ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# ---------- 2. prod-only deps ----------
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- 3. runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

# Run as non-root for security
RUN addgroup -S nova && adduser -S nova -G nova

ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_LOGLEVEL=warn

# Copy prod node_modules + project files
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --chown=nova:nova . .

USER nova

EXPOSE 3000

# Crash-free restarts + log to stdout (Render / Fly capture stdout)
CMD ["node", "server.js"]
