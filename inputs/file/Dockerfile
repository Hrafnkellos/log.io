# Multi-stage Dockerfile for log.io-file-input
# Builder stage
FROM node:18 AS builder
WORKDIR /app
# Copy package manifests (package.json and optional package-lock.json)
COPY package*.json ./
COPY .npmrc* .
# Install dependencies but don't run lifecycle scripts (prepare/build) yet.
# This ensures we don't run `npm run build` before the source files are copied.
RUN npm ci --ignore-scripts || npm install --legacy-peer-deps --ignore-scripts
# Copy source and build
COPY . .
# Now run the project build; lifecycle scripts are expected to run here.
RUN npm run build

# Runtime stage
FROM node:18-slim
WORKDIR /app
# Copy package metadata
COPY package.json package-lock.json* ./
# Copy production dependencies from the builder to avoid running npm in the slim runtime
COPY --from=builder /app/node_modules ./node_modules
# Copy built files
COPY --from=builder /app/lib ./lib
# Copy bin if needed
COPY --from=builder /app/bin ./bin

EXPOSE 28777
# Default command to run
CMD ["node", "lib/index.js"]
