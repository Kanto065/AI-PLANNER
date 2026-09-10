import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/require-user";
import { Blueprint } from "@/lib/design/Blueprint";
import { TaskRow, type TaskRowData } from "@/lib/design/TaskRow";
import { AddTaskButton } from "@/lib/design/AddTaskButton";
import { WeekStrip } from "@/lib/design/WeekStrip";
import { CalendarPicker } from "@/lib/design/CalendarPicker";
import { addDays, dayLabelForDate, formatHM, fmtElapsedSeconds, parseDateKey, startOfDay, startOfWeek, toDateKey } from "@/lib/date-utils";
import { GoalStatus } from "@prisma/client";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const userId = await requireUserId();
  const { date } = await searchParams;

  const today = startOfDay(new Date());
  const selectedDate = date ? parseDateKey(date) : today;
  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [weekTasks, openLog, weekLogs, activeGoals] = await Promise.all([
    prisma.task.findMany({
      where: { userId, scheduledDate: { gte: weekStart, lt: addDays(weekStart, 7) } },
      include: { goal: { select: { title: true } } },
      orderBy: { scheduledStart: "asc" },
    }),
    prisma.timeLog.findFirst({ where: { userId, endedAt: null } }),
    prisma.timeLog.findMany({
      where: { userId, startedAt: { gte: addDays(today, -6) } },
      select: { startedAt: true, durationSeconds: true },
    }),
    prisma.goal.findMany({
      where: { userId, status: GoalStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, progressPercent: true },
    }),
  ]);

  const countsByDate: Record<string, number> = {};
  for (const t of weekTasks) {
    const key = toDateKey(t.scheduledDate);
    countsByDate[key] = (countsByDate[key] ?? 0) + 1;
  }

  const selectedKey = toDateKey(selectedDate);
  const tasks = weekTasks.filter((t) => toDateKey(t.scheduledDate) === selectedKey);

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
  const goalOptions = activeGoals.map((g) => ({ id: g.id, title: g.title }));

  // "This week" bar chart: hours logged per day, last 7 days ending today.
  // Deliberately independent of whichever week is currently being browsed.
  const dayKeys = Array.from({ length: 7 }, (_, i) => addDays(today, -6 + i));
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

  const dateStr = selectedDate.toISOString();
  const prevWeekKey = toDateKey(addDays(selectedDate, -7));
  const nextWeekKey = toDateKey(addDays(selectedDate, 7));

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_280px]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href={`/today?date=${prevWeekKey}`} className="btn btn-icon btn-secondary" style={{ padding: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 5l-7 7 7 7" /></svg>
            </Link>
            <h2 className="m-0">{dayLabelForDate(selectedDate)}</h2>
            <Link href={`/today?date=${nextWeekKey}`} className="btn btn-icon btn-secondary" style={{ padding: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5l7 7-7 7" /></svg>
            </Link>
            <CalendarPicker selectedDate={selectedDate} today={today} />
          </div>
          <div className="flex items-center gap-2">
            <span className="tag tag-outline">{doneCount}/{tasks.length} done</span>
            <AddTaskButton
              scheduledDate={dateStr}
              goals={goalOptions}
              className="btn btn-icon btn-secondary"
              style={{ padding: 6 }}
            />
          </div>
        </div>

        <div className="mb-4">
          <WeekStrip weekDays={weekDays} selectedDate={selectedDate} today={today} countsByDate={countsByDate} />
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
            <AddTaskButton scheduledDate={dateStr} goals={goalOptions} />
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
              activeGoals.slice(0, 5).map((g) => (
                <Link key={g.id} href={`/goals?goal=${g.id}`} className="flex items-center justify-between gap-2" style={{ color: "inherit", textDecoration: "none" }}>
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
