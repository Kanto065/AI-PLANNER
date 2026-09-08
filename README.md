# Kanto Planner

Personal daily planner and goal-tracking app. Self-hosted on a single VPS.

Stack: Next.js (App Router, PWA-enabled) · Postgres · Prisma · Auth.js
(credentials login) · Docker Compose (postgres + web + Caddy) · Groq
(primary) / Gemini (fallback) for AI reasoning, called only from server-side
API routes.

## Local development

Two things need to be running: Postgres (via Docker) and the Next.js dev
server (on the host, for fast refresh).

1. Copy env vars (already done for you locally as `.env` / `.env.local` -
   see `.env.example` for the full list if you need to regenerate them).
2. Start Postgres only:
   ```bash
   docker compose up -d postgres
   ```
3. Apply the schema and seed the single user account:
   ```bash
   npx prisma migrate dev --name init
   npx prisma db seed
   ```
4. Run the app:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000 and sign in with the admin credentials from
   `.env.local` (`admin` / `admin` by default - change `ADMIN_PASSWORD`
   before this app is reachable from the internet).

### Running the full stack (web + Caddy) locally

To sanity-check the production Docker setup before deploying:

```bash
docker compose up -d --build
```

This builds the Next.js app image, runs Prisma migrations automatically on
container start, and fronts everything with Caddy. With `SITE_ADDRESS`
left at `localhost` in `.env`, Caddy serves a locally-trusted HTTPS cert at
https://localhost.

## Deploying to the VPS

See [`DEPLOY.md`](./DEPLOY.md).

## Project structure

- `prisma/schema.prisma` - data model (Users, Goals, Tasks, TimeLogs,
  UserStats, ConversationSummaries, GoalFeasibilityLog).
- `prisma/seed.ts` - creates the single user account from `ADMIN_*` env vars.
- `src/auth.ts` - Auth.js config (Credentials provider now, Google ready to
  enable later by setting `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`).
- `src/middleware.ts` - redirects unauthenticated requests to `/login`.
- `docker-compose.yml` / `Dockerfile` / `Caddyfile` - production deployment.
