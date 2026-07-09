# Multi-stage build (SDD §26): compile with the full toolchain, ship only the runtime.

# --- stage 1: build ---
FROM node:22-alpine AS build
WORKDIR /app
# Copy manifests FIRST so the dependency layer is cached until package files change.
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci
COPY server server
RUN npm run build -w server

# --- stage 2: production dependencies only ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci --omit=dev

# --- stage 3: runtime ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/server/dist   ./server/dist
COPY server/public ./server/public
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "server/dist/server.js"]
