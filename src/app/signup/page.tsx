import { SignupForm } from "./SignupForm";

// See login/page.tsx - must not be statically baked in at Docker build time.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return <SignupForm googleEnabled={googleEnabled} />;
}
