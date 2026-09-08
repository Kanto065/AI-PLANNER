import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/require-user";
import { Blueprint } from "@/lib/design/Blueprint";
import { levelForXp } from "@/lib/xp";
import { getDayCleanliness } from "@/lib/streaks";
import { addDays, dayOffsetToDate } from "@/lib/date-utils";

export default async function StatsPage() {
  const userId = await requireUserId();

  const [stats, days, weekLogs] = await Promise.all([
    prisma.userStats.upsert({ where: { userId }, create: { userId }, update: {} }),
    getDayCleanliness(userId, 14),
    prisma.timeLog.findMany({
      where: { userId, startedAt: { gte: addDays(dayOffsetToDate(0), -6) } },
      select: { startedAt: true, durationSeconds: true },
    }),
  ]);

  const { level, xpIntoLevel, xpForLevel } = levelForXp(stats.xp);
  const today = days[days.length - 1];
  const todayHasSkip = today && !today.clean && today.hasTasks;

  const dayKeys = Array.from({ length: 7 }, (_, i) => addDays(dayOffsetToDate(0), -6 + i));
  const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hoursByDay = dayKeys.map((d) => {
    const next = addDays(d, 1);
    const seconds = weekLogs.filter((l) => l.startedAt >= d && l.startedAt < next).reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
    return seconds / 3600;
  });
  const maxHours = Math.max(1, ...hoursByDay);

  return (
    <div>
      <h2 className="mb-4">Stats</h2>

      <div className="mb-5 grid gap-3.5 md:grid-cols-3">
        <Blueprint className="p-4.5" style={{ background: "var(--color-bg)" }}>
          <div className="text-muted mb-1.5" style={{ fontSize: 12 }}>Level</div>
          <div className="mb-2" style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 26 }}>{level}</div>
          <div className="mb-1.5" style={{ height: 5, background: "var(--color-divider)" }}>
            <div style={{ height: "100%", background: "var(--color-accent)", width: `${(xpIntoLevel / xpForLevel) * 100}%` }} />
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>{xpIntoLevel} / {xpForLevel} XP to next level · {stats.xp} total</div>
        </Blueprint>

        <Blueprint className="p-4.5" style={{ background: "var(--color-bg)" }}>
          <div className="text-muted mb-1.5 flex items-center gap-1.5" style={{ fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2c1.5 3 5 5.5 5 10a5 5 0 1 1-10 0c0-1.5.5-2.5 1.3-3.4C8.7 10 9 12 10 12c-.3-3 1-6 2-10z" /></svg>
            Current streak
          </div>
          <div className="mb-1" style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 26 }}>{stats.streakCount} days</div>
          <div className="text-muted" style={{ fontSize: 11 }}>
            {todayHasSkip ? "Broken today — a task was skipped" : "Still alive — keep today clean"}
          </div>
        </Blueprint>

        <Blueprint className="p-4.5" style={{ background: "var(--color-bg)" }}>
          <div className="text-muted mb-1.5" style={{ fontSize: 12 }}>Longest streak</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 26 }}>{stats.longestStreak} days</div>
        </Blueprint>
      </div>

      <Blueprint className="mb-5 p-4.5" style={{ background: "var(--color-bg)" }}>
        <h6 className="mb-3">Last 14 days</h6>
        <div className="flex gap-1.5">
          {days.map((d) => (
            <div
              key={d.dateKey}
              title={d.hasTasks ? (d.clean ? "Complete" : "Broken") : "No tasks"}
              style={{ flex: 1, height: 20, background: d.clean ? "var(--color-accent)" : "var(--color-divider)", border: "1px solid var(--color-divider)" }}
            />
          ))}
        </div>
      </Blueprint>

      <Blueprint className="p-4.5" style={{ background: "var(--color-bg)" }}>
        <h6 className="mb-3">Hours logged, last 7 days</h6>
        <div className="flex items-end gap-2" style={{ height: 70 }}>
          {hoursByDay.map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
              <div style={{ width: "100%", background: "color-mix(in srgb, var(--color-accent) 40%, transparent)", height: `${Math.min(100, (h / maxHours) * 100)}%`, minHeight: 2 }} />
              <span className="text-muted" style={{ fontSize: 10 }}>{weekLabels[dayKeys[i].getDay()]}</span>
            </div>
          ))}
        </div>
      </Blueprint>
    </div>
  );
}
