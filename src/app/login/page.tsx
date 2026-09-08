import { LoginForm } from "./LoginForm";

// Must be evaluated per-request, not baked in at build time: the Docker
// build stage never sees the real GOOGLE_CLIENT_ID/SECRET (only
// docker-compose injects those, at container runtime).
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return <LoginForm googleEnabled={googleEnabled} />;
}
