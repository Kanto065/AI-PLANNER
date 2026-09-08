"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "@/lib/actions/settings";

const initial: ChangePasswordState = {};

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initial);

  return (
    <form action={formAction}>
      <div className="field mb-2.5">
        <label htmlFor="currentPassword">Current password</label>
        <input className="input" id="currentPassword" name="currentPassword" type="password" required />
      </div>
      <div className="field mb-2.5">
        <label htmlFor="newPassword">New password</label>
        <input className="input" id="newPassword" name="newPassword" type="password" required minLength={8} />
      </div>
      <div className="field mb-3.5">
        <label htmlFor="confirmPassword">Confirm new password</label>
        <input className="input" id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
      </div>
      {state.error ? <p className="mb-2.5" style={{ color: "var(--color-accent-800)", fontSize: 13 }}>{state.error}</p> : null}
      {state.success ? <p className="mb-2.5" style={{ color: "var(--color-accent)", fontSize: 13 }}>Password updated.</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
