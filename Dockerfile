# --- deps: install dependencies only (cached separately from source) ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --- builder: build the Next.js app ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runner: production image (kept simple, not "standalone" output, so the
# full prisma CLI is available for `prisma migrate deploy` on container start) ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
