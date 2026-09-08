import { signOut } from "@/auth";
import { Blueprint } from "@/lib/design/Blueprint";
import { PasswordForm } from "@/lib/design/PasswordForm";
import { AppearancePicker } from "@/lib/design/AppearancePicker";

export default function SettingsPage() {
  return (
    <div>
      <h2 className="mb-4">Settings</h2>
      <div className="flex max-w-[480px] flex-col gap-4">
        <Blueprint className="p-4.5" style={{ background: "var(--color-bg)" }}>
          <h6 className="mb-3.5">Change password</h6>
          <PasswordForm />
        </Blueprint>

        <Blueprint className="p-4.5" style={{ background: "var(--color-bg)" }}>
          <div className="mb-1.5 flex items-center justify-between">
            <h6 className="m-0">AI provider keys</h6>
            <span className="tag tag-outline">Coming soon</span>
          </div>
          <div className="text-muted mb-3" style={{ fontSize: 13 }}>
            Bring your own API key for triage and feasibility reasoning.
          </div>
          <input className="input" disabled placeholder="sk-••••••••••••••••" />
        </Blueprint>

        <Blueprint className="p-4.5" style={{ background: "var(--color-bg)" }}>
          <h6 className="mb-3">Appearance</h6>
          <AppearancePicker />
        </Blueprint>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="btn btn-secondary" style={{ display: "flex", gap: 6, justifyContent: "center", width: "100%" }} type="submit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 4H5v16h4M16 12H9M13 8l4 4-4 4" /></svg>
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
