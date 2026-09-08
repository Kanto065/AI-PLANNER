"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "./actions";
import { Blueprint } from "@/lib/design/Blueprint";

const initialState: LoginState = {};

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center p-6" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
      <Blueprint className="w-full max-w-[360px]" style={{ padding: "32px 28px", background: "var(--color-bg)" }}>
        <form action={formAction}>
          <div className="mb-7 text-center">
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 28, letterSpacing: "-0.02em" }}>AI Planner</div>
            <div className="text-muted mt-1" style={{ fontSize: 13 }}>Sign in to your account</div>
          </div>

          <div className="field mb-3.5">
            <label htmlFor="identifier">Email or username</label>
            <input id="identifier" name="identifier" type="text" required autoComplete="username" className="input" placeholder="you@yourdomain.com" />
          </div>

          <div className="field mb-5">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" placeholder="••••••••" />
          </div>

          {state.error ? (
            <p className="mb-3" style={{ color: "var(--color-accent-800)", fontSize: 13 }}>{state.error}</p>
          ) : null}

          <button type="submit" disabled={pending} className="btn btn-primary btn-block" style={{ width: "100%", marginBottom: 10 }}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
          {googleEnabled ? (
            <Link href="/api/auth/signin/google?callbackUrl=/today" className="btn btn-secondary" style={{ width: "100%", display: "flex", gap: 8, marginBottom: 12 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12h8M12 8v8" />
              </svg>
              Continue with Google
            </Link>
          ) : (
            <button type="button" disabled className="btn btn-secondary" style={{ width: "100%", display: "flex", gap: 8, marginBottom: 12 }} title="Not configured yet">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12h8M12 8v8" />
              </svg>
              Continue with Google
            </button>
          )}
          <div className="text-center" style={{ fontSize: 13 }}>
            <Link href="/signup" className="btn-ghost btn" style={{ padding: 0 }}>Don&apos;t have an account? Sign up</Link>
          </div>
        </form>
      </Blueprint>
    </main>
  );
}
