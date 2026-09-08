import { prisma } from "@/lib/prisma";

type DayBucket = { dateKey: string; statuses: string[] };

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Strict streak: a day only counts as "clean" if it had at least one task
 * and every task on it was completed (a skipped or still-pending task
 * breaks it). Pure function so it's easy to reason about/test separately
 * from the DB.
 */
export function computeStreaks(days: DayBucket[], todayKey: string) {
  const byDate = new Map(days.map((d) => [d.dateKey, d.statuses]));
  const isClean = (statuses: string[] | undefined) =>
    !!statuses && statuses.length > 0 && statuses.every((s) => s === "COMPLETED");

  // Current streak: walk backward from yesterday (today never counts until
  // it's over).
  let currentStreak = 0;
  const cursor = new Date(todayKey + "T00:00:00.000Z");
  for (;;) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const key = dateKey(cursor);
    if (!byDate.has(key)) break;
    if (!isClean(byDate.get(key))) break;
    currentStreak++;
  }

  // Longest streak: scan every day we have data for.
  const sortedKeys = [...byDate.keys()].sort();
  let longestStreak = 0;
  let run = 0;
  for (const key of sortedKeys) {
    if (isClean(byDate.get(key))) {
      run++;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }

  const todayStatuses = byDate.get(todayKey) ?? [];
  const todayHasSkip = todayStatuses.includes("SKIPPED");
  const streakAliveToday = !todayHasSkip;

  return { currentStreak, longestStreak, todayHasSkip, streakAliveToday };
}

/** Recomputes and persists streaks for a user - call after any task
 * status change (complete/skip). Looks back 90 days, which is plenty for
 * both current and longest streak in a personal-use app. */
export async function recomputeStreaks(userId: string) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 90);

  const tasks = await prisma.task.findMany({
    where: { userId, scheduledDate: { gte: since } },
    select: { scheduledDate: true, status: true },
  });

  const grouped = new Map<string, string[]>();
  for (const t of tasks) {
    const key = dateKey(t.scheduledDate);
    const arr = grouped.get(key) ?? [];
    arr.push(t.status);
    grouped.set(key, arr);
  }
  const days = [...grouped.entries()].map(([dateKey, statuses]) => ({ dateKey, statuses }));

  const todayKey = dateKey(new Date());
  const { currentStreak, longestStreak } = computeStreaks(days, todayKey);

  const stats = await prisma.userStats.findUnique({ where: { userId } });
  const nextLongest = Math.max(longestStreak, stats?.longestStreak ?? 0);

  await prisma.userStats.upsert({
    where: { userId },
    create: { userId, streakCount: currentStreak, longestStreak: nextLongest },
    update: { streakCount: currentStreak, longestStreak: nextLongest },
  });

  return { currentStreak, longestStreak: nextLongest };
}

/** Per-day clean/broken flags for the last N days (including today), for
 * the Stats screen's day-dot grid. */
export async function getDayCleanliness(userId: string, days: number) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);

  const tasks = await prisma.task.findMany({
    where: { userId, scheduledDate: { gte: since } },
    select: { scheduledDate: true, status: true },
  });

  const grouped = new Map<string, string[]>();
  for (const t of tasks) {
    const key = dateKey(t.scheduledDate);
    const arr = grouped.get(key) ?? [];
    arr.push(t.status);
    grouped.set(key, arr);
  }

  const out: { dateKey: string; hasTasks: boolean; clean: boolean }[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < days; i++) {
    const key = dateKey(cursor);
    const statuses = grouped.get(key);
    out.push({
      dateKey: key,
      hasTasks: !!statuses && statuses.length > 0,
      clean: !!statuses && statuses.length > 0 && statuses.every((s) => s === "COMPLETED"),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
