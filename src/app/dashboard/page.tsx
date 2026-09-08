import { auth, signOut } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Welcome, {session?.user?.name ?? "there"}
        </h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="text-sm underline">
            Sign out
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm text-black/60 dark:text-white/60">
        Foundation scaffold is live. Goals, the daily timeline, time-logging,
        streaks/XP, and triage will be built here next.
      </p>
    </main>
  );
}
