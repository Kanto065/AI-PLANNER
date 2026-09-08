import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/require-user";
import { Blueprint } from "@/lib/design/Blueprint";
import { NewGoalButton } from "@/lib/design/NewGoalButton";
import { GoalDetailPanel, type GoalDetailData } from "@/lib/design/GoalDetailPanel";
import { feasibilityBucket, deadlineLabel, statusLabel } from "@/lib/feasibility";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string }>;
}) {
  const userId = await requireUserId();
  const { goal: selectedGoalId } = await searchParams;

  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const timeLogsByGoal = await prisma.timeLog.findMany({
    where: { task: { goalId: { in: goals.map((g) => g.id) } } },
    select: { durationSeconds: true, task: { select: { goalId: true } } },
  });
  const loggedHoursByGoalId = new Map<string, number>();
  for (const l of timeLogsByGoal) {
    const goalId = l.task.goalId!;
    loggedHoursByGoalId.set(goalId, (loggedHoursByGoalId.get(goalId) ?? 0) + (l.durationSeconds ?? 0) / 3600);
  }

  const goalsView = goals.map((g) => {
    const fb = feasibilityBucket(g);
    return {
      id: g.id,
      title: g.title,
      category: g.category ?? "Personal",
      statusLabel: statusLabel(g.status),
      feasBucket: fb.bucket,
      feasLabel: fb.label,
      progressPercent: Math.round(g.progressPercent),
      loggedHours: Math.round((loggedHoursByGoalId.get(g.id) ?? 0) * 10) / 10,
      estHours: g.estimatedHours,
      deadlineLabel: deadlineLabel(g.deadline),
    };
  });

  let selectedGoal: GoalDetailData | null = null;
  if (selectedGoalId) {
    const g = goals.find((x) => x.id === selectedGoalId);
    if (g) {
      const [logs, tasks, logEntries] = await Promise.all([
        prisma.timeLog.findMany({ where: { task: { goalId: g.id } }, select: { durationSeconds: true } }),
        prisma.task.findMany({ where: { goalId: g.id }, select: { title: true, status: true }, orderBy: { scheduledDate: "asc" } }),
        prisma.goalFeasibilityLog.findMany({ where: { goalId: g.id }, orderBy: { createdAt: "desc" } }),
      ]);
      const loggedHours = logs.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0) / 3600;
      const fb = feasibilityBucket(g);
      const taskStatusLabel = (s: string) => ({ COMPLETED: "Done", IN_PROGRESS: "In progress", PENDING: "Upcoming", SKIPPED: "Skipped" })[s] ?? s;

      selectedGoal = {
        id: g.id,
        title: g.title,
        category: g.category,
        statusLabel: statusLabel(g.status),
        status: g.status,
        description: g.description,
        estimatedHours: g.estimatedHours,
        deadlineIso: g.deadline ? g.deadline.toISOString().slice(0, 10) : null,
        loggedHours,
        estHours: g.estimatedHours,
        deadlineLabel: deadlineLabel(g.deadline),
        progressPercent: Math.round(g.progressPercent),
        feasBucket: fb.bucket,
        feasOverridden: g.feasibilityOverride,
        feasScore: g.feasibilityScore,
        feasReason: g.feasibilityReason,
        overrideNote: g.feasibilityOverrideNote,
        history: logEntries.map((l) => ({
          date: l.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          label: l.reason,
        })),
        linkedTasks: tasks.map((t) => ({ title: t.title, statusLabel: taskStatusLabel(t.status) })),
      };
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_420px]">
      <div className={selectedGoalId ? "hidden md:block" : ""}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0">Goals</h2>
          <NewGoalButton />
        </div>

        {goalsView.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {goalsView.map((g) => (
              <Link key={g.id} href={`/goals?goal=${g.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                <Blueprint className="p-4" style={{ background: "var(--color-bg)", cursor: "pointer" }}>
                  <div className="mb-2 flex items-start justify-between gap-2.5">
                    <div>
                      <div className="mb-1" style={{ fontWeight: 500, fontSize: 15 }}>{g.title}</div>
                      <span className="tag tag-neutral">{g.category}</span>{" "}
                      <span className="tag tag-outline">{g.statusLabel}</span>
                    </div>
                    {g.feasBucket === "onTrack" && (
                      <span className="tag tag-outline" style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 5-5" /></svg>
                        On track
                      </span>
                    )}
                    {g.feasBucket === "atRisk" && (
                      <span className="tag" style={{ display: "flex", gap: 5, alignItems: "center", background: "var(--color-accent-200)", color: "var(--color-accent-800)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3.5 21 20H3z" /><path d="M12 9.5v5" /></svg>
                        At risk
                      </span>
                    )}
                    {g.feasBucket === "unrealistic" && (
                      <span className="tag" style={{ display: "flex", gap: 5, alignItems: "center", background: "var(--color-accent-800)", color: "var(--color-bg)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" /><path d="M12 8v5" /></svg>
                        Unrealistic
                      </span>
                    )}
                    {g.feasBucket === "unknown" && (
                      <span className="tag tag-neutral" style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.5-1 1-1 1.7" /></svg>
                        {g.feasLabel}
                      </span>
                    )}
                  </div>
                  <div className="mb-2" style={{ height: 5, background: "var(--color-divider)" }}>
                    <div style={{ height: "100%", background: "var(--color-accent)", width: `${g.progressPercent}%` }} />
                  </div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {g.loggedHours}h logged{g.estHours != null ? ` of ${g.estHours}h est.` : ""} · {g.deadlineLabel}
                  </div>
                </Blueprint>
              </Link>
            ))}
          </div>
        ) : (
          <Blueprint className="p-10 text-center" style={{ background: "var(--color-bg)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 12px", opacity: 0.5 }}>
              <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" />
            </svg>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>No goals yet</div>
            <div className="text-muted mb-4" style={{ fontSize: 13 }}>
              Add something you&apos;re working toward — feasibility will be tracked as you go.
            </div>
            <NewGoalButton />
          </Blueprint>
        )}
      </div>

      {selectedGoal ? (
        <div>
          <Link href="/goals" className="btn btn-ghost mb-3.5 md:hidden" style={{ display: "flex", gap: 5, width: "fit-content" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 5l-7 7 7 7" /></svg>
            Goals
          </Link>
          <GoalDetailPanel goal={selectedGoal} />
        </div>
      ) : (
        <Blueprint className="hidden self-start p-6 text-center md:block" style={{ background: "var(--color-bg)" }}>
          <div className="text-muted" style={{ fontSize: 13 }}>Select a goal to see its feasibility detail.</div>
        </Blueprint>
      )}
    </div>
  );
}
