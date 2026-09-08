import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/require-user";
import { Blueprint } from "@/lib/design/Blueprint";
import { TaskRow, type TaskRowData } from "@/lib/design/TaskRow";
import { AddTaskButton } from "@/lib/design/AddTaskButton";
import { addDays, dayLabel, dayOffsetToDate, formatHM, fmtElapsedSeconds } from "@/lib/date-utils";
import { GoalStatus } from "@prisma/client";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const userId = await requireUserId();
  const { day } = await searchParams;
  const dayOffset = Number.isFinite(Number(day)) ? Number(day) : 0;

  const targetDate = dayOffsetToDate(dayOffset);
  const nextDate = addDays(targetDate, 1);

  const [tasks, openLog, weekLogs, activeGoals] = await Promise.all([
    prisma.task.findMany({
      where: { userId, scheduledDate: { gte: targetDate, lt: nextDate } },
      include: { goal: { select: { title: true } } },
      orderBy: { scheduledStart: "asc" },
    }),
    prisma.timeLog.findFirst({ where: { userId, endedAt: null } }),
    prisma.timeLog.findMany({
      where: { userId, startedAt: { gte: addDays(dayOffsetToDate(0), -6) } },
      select: { startedAt: true, durationSeconds: true },
    }),
    prisma.goal.findMany({
      where: { userId, status: GoalStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, progressPercent: true },
    }),
  ]);

  // This is a Server Component: it renders once per request on the server,
  // so a real timestamp here is correct, not a purity violation (the lint
  // rule doesn't distinguish server components from client ones).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const tasksView: TaskRowData[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    timeRange: t.scheduledStart && t.scheduledEnd ? `${formatHM(t.scheduledStart)}–${formatHM(t.scheduledEnd)}` : "—",
    goalTitle: t.goal?.title ?? null,
    isRoutine: t.isRoutine,
    difficulty: t.difficulty,
    status: t.status,
    isRunning: openLog?.taskId === t.id,
    runningLabel: openLog?.taskId === t.id ? fmtElapsedSeconds(Math.round((now - openLog.startedAt.getTime()) / 1000)) : null,
  }));

  const doneCount = tasks.filter((t) => t.status === "COMPLETED").length;

  // "This week" bar chart: hours logged per day, last 7 days ending today.
  const dayKeys = Array.from({ length: 7 }, (_, i) => addDays(dayOffsetToDate(0), -6 + i));
  const hoursByDay = dayKeys.map((d) => {
    const next = addDays(d, 1);
    const seconds = weekLogs
      .filter((l) => l.startedAt >= d && l.startedAt < next)
      .reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
    return seconds / 3600;
  });
  const maxHours = Math.max(1, ...hoursByDay);
  const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekTotal = hoursByDay.reduce((a, b) => a + b, 0);

  const dateStr = targetDate.toISOString();

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_280px]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href={`/today?day=${dayOffset - 1}`} className="btn btn-icon btn-secondary" style={{ padding: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 5l-7 7 7 7" /></svg>
            </Link>
            <h2 className="m-0">{dayLabel(dayOffset, targetDate)}</h2>
            <Link href={`/today?day=${dayOffset + 1}`} className="btn btn-icon btn-secondary" style={{ padding: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          <span className="tag tag-outline">{doneCount}/{tasks.length} done</span>
        </div>

        {tasksView.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {tasksView.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        ) : (
          <Blueprint className="p-10 text-center" style={{ background: "var(--color-bg)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 12px", opacity: 0.5 }}>
              <rect x="3" y="4" width="18" height="17" rx="1" />
              <path d="M3 9h18M8 2v4M16 2v4" />
            </svg>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Nothing scheduled</div>
            <div className="text-muted mb-4" style={{ fontSize: 13 }}>No tasks planned for this day yet.</div>
            <AddTaskButton scheduledDate={dateStr} />
          </Blueprint>
        )}
      </div>

      <div className="hidden md:flex md:flex-col gap-4">
        <Blueprint className="p-4" style={{ background: "var(--color-bg)" }}>
          <h6 className="mb-3">This week</h6>
          <div className="flex items-end gap-1.5" style={{ height: 60 }}>
            {hoursByDay.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
                <div style={{ width: "100%", background: "color-mix(in srgb, var(--color-accent) 35%, transparent)", height: `${Math.min(100, (h / maxHours) * 100)}%`, minHeight: 2 }} />
                <span className="text-muted" style={{ fontSize: 10 }}>{weekLabels[dayKeys[i].getDay()]}</span>
              </div>
            ))}
          </div>
          <div className="text-muted mt-2" style={{ fontSize: 12 }}>{weekTotal.toFixed(1)}h logged this week</div>
        </Blueprint>

        <Blueprint className="p-4" style={{ background: "var(--color-bg)" }}>
          <h6 className="mb-3">Active goals</h6>
          <div className="flex flex-col gap-2.5">
            {activeGoals.length === 0 ? (
              <span className="text-muted" style={{ fontSize: 13 }}>No active goals yet.</span>
            ) : (
              activeGoals.map((g) => (
                <Link key={g.id} href={`/goals?goal=${g.id}`} className="flex items-center justify-between gap-2">
                  <span style={{ fontSize: 13 }}>{g.title}</span>
                  <span className="text-muted" style={{ fontSize: 12 }}>{Math.round(g.progressPercent)}%</span>
                </Link>
              ))
            )}
          </div>
        </Blueprint>
      </div>
    </div>
  );
}
