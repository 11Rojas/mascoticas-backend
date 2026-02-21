# ── Stage 1: Install deps ─────────────────────────────────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app

# Copy installed dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment defaults (override at runtime or via docker-compose)
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
