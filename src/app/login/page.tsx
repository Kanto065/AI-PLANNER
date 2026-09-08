"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-lg border border-black/10 p-6 dark:border-white/15"
      >
        <h1 className="text-xl font-semibold">Kanto Planner</h1>

        <div className="space-y-1">
          <label htmlFor="identifier" className="text-sm font-medium">
            Email or username
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            required
            autoComplete="username"
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          />
        </div>

        {state.error ? (
          <p className="text-sm text-red-500">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
