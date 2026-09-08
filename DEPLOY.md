# Deploying to the VPS

This VPS is shared with another project that already owns ports 80/443 via
its own Caddy container (`platform-caddy-1`, config at
`/opt/platform/deploy/caddy/Caddyfile`, docker network `platform_internal`).
So `docker-compose.yml` here runs **only** `postgres` + `web` - no Caddy of
its own - and joins `web` to that existing network so the existing Caddy can
reverse-proxy to it.

`kanto-planner.duckdns.org` already resolves to this VPS's IP.

## One-time setup on the VPS

1. Clone the repo (deploy branch) somewhere separate from the other
   project, e.g. `/opt/kanto-planner`:
   ```bash
   git clone -b deploy <your-repo-url> /opt/kanto-planner
   cd /opt/kanto-planner
   ```
2. Create `.env` from `.env.example` with real values:
   - `SITE_ADDRESS=kanto-planner.duckdns.org`
   - `AUTH_SECRET` - generate with `openssl rand -base64 32`
   - `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` - **a real
     password, not `admin`**, since this becomes reachable on the public
     internet the moment the vhost is added.
   - `POSTGRES_*` - fine to leave as defaults, this Postgres is only
     reachable from `web` on the internal docker network.
   - `PROXY_NETWORK=platform_internal` (matches the existing project's
     network name - confirm with `docker network ls` if it's ever renamed).
   - `GROQ_API_KEY` / `GEMINI_API_KEY` - add when the AI triage feature is
     built; safe to leave blank for now.
3. Build and start:
   ```bash
   docker compose up -d --build
   ```
   The `web` container runs `prisma migrate deploy` automatically on start
   (see `docker-entrypoint.sh`). Seed the admin user once:
   ```bash
   docker compose exec web npx prisma db seed
   ```
4. Add the site block to the **existing** shared Caddy config (see
   `deploy/shared-caddy-snippet.Caddyfile` in this repo for the exact
   block) - append it to `/opt/platform/deploy/caddy/Caddyfile` on the VPS,
   then reload without dropping the other project's connections:
   ```bash
   docker exec platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile
   ```
5. Visit https://kanto-planner.duckdns.org and sign in.

## Subsequent deploys

Pushing to (or merging a PR into) the `deploy` branch on GitHub triggers
`.github/workflows/deploy.yml`, which pushes the checked-out commit
straight to `/opt/kanto-planner` on the VPS over SSH. A `post-receive` git
hook there then runs `docker compose up -d --build` and re-seeds the admin
user (idempotent). Nothing on the VPS needs to poll or pull.

The deploy key GitHub uses (`VPS_SSH_KEY` secret) is restricted server-side
(via `command=` in `authorized_keys`) to only run `git-receive-pack` for
this one repo path - it cannot open a shell or run anything else on the
VPS, even though the account is root.

To deploy manually instead (e.g. no internet/GitHub access), push directly
from a machine that already has a `vps` git remote configured:

```bash
git push vps deploy:deploy
```

Prisma migrations run automatically on container start. The Caddyfile step
above only needs to happen once, unless the domain or container name
changes.

## Rollback

```bash
git log --oneline -5   # find the previous good commit
git checkout <commit> -- .
docker compose up -d --build
```

Postgres data lives in the `postgres_data` named volume, independent of the
git checkout, so a code rollback does not touch existing data.
