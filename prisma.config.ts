import { defineConfig, env } from "prisma/config";

// prisma.config.ts loading does NOT auto-read .env files (unlike the old
// schema.prisma `url = env(...)` behavior), so load it explicitly.
try {
  process.loadEnvFile();
} catch {
  // no .env file present (e.g. in the Docker image, where real env vars
  // are injected by docker-compose instead) - that's fine.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
