import { prisma } from "@/lib/prisma";
import { FeasibilityStatus, FeasibilitySource } from "@prisma/client";

const ON_TRACK_THRESHOLD = 70;
const AT_RISK_THRESHOLD = 30;

function round(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Recalculates a goal's feasibility snapshot from real logged time vs.
 * estimate/deadline, writes a GoalFeasibilityLog entry, and updates the
 * Goal's cached snapshot fields + derived progress. Safe to call after any
 * time-log or goal-field change - it always reflects the live numbers.
 *
 * A manual override (see submitOverride in actions/goals.ts) is an
 * annotation layered on top, not a replacement: this function keeps
 * recalculating and overwriting the status/score/reason regardless of
 * whether feasibilityOverride is set.
 */
export async function recalculateFeasibility(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

  const logs = await prisma.timeLog.findMany({
    where: { task: { goalId }, durationSeconds: { not: null } },
    select: { durationSeconds: true },
  });
  const loggedHours = logs.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0) / 3600;

  let score: number | null = null;
  let status: FeasibilityStatus = FeasibilityStatus.UNKNOWN;
  let reason: string;

  const progressPercent = goal.estimatedHours
    ? Math.min(100, round((loggedHours / goal.estimatedHours) * 100))
    : goal.progressPercent;

  if (!goal.estimatedHours) {
    reason = "No estimate set — add estimated hours to see feasibility.";
  } else if (!goal.deadline) {
    if (loggedHours > 0) {
      status = FeasibilityStatus.ON_TRACK;
      reason = `You've logged ${round(loggedHours)}h of an estimated ${goal.estimatedHours}h. There's no deadline set, so this is just tracking effort, not projecting a finish date.`;
    } else {
      reason = "No time logged yet and no deadline set — feasibility will appear once you start tracking.";
    }
  } else {
    const now = new Date();
    const daysSinceCreated = Math.max(1, (now.getTime() - goal.createdAt.getTime()) / 86_400_000);
    const daysLeft = Math.ceil((goal.deadline.getTime() - now.getTime()) / 86_400_000);
    const pace = loggedHours / daysSinceCreated;
    const paceWeek = round(pace * 7);

    if (daysLeft <= 0) {
      score = Math.min(100, round((loggedHours / goal.estimatedHours) * 100));
      status = score >= 100 ? FeasibilityStatus.ON_TRACK : FeasibilityStatus.UNREALISTIC;
      reason =
        score >= 100
          ? `You've logged ${round(loggedHours)}h of the estimated ${goal.estimatedHours}h — the deadline has passed but the goal is complete.`
          : `The deadline has passed with ${round(loggedHours)}h of an estimated ${goal.estimatedHours}h logged (${score}%) — this goal is overdue.`;
    } else {
      const projectedTotal = loggedHours + pace * daysLeft;
      score = Math.min(100, Math.max(0, Math.round((projectedTotal / goal.estimatedHours) * 100)));
      status =
        score >= ON_TRACK_THRESHOLD
          ? FeasibilityStatus.ON_TRACK
          : score >= AT_RISK_THRESHOLD
            ? FeasibilityStatus.AT_RISK
            : FeasibilityStatus.UNREALISTIC;

      reason = `You've logged ${round(loggedHours)}h of an estimated ${goal.estimatedHours}h with ${daysLeft} day${daysLeft === 1 ? "" : "s"} left — at your current pace (~${paceWeek}h/week) you're projected to reach about ${score}% by the deadline.`;
      if (status === FeasibilityStatus.UNREALISTIC) {
        reason += " This isn't feasible in the current window.";
      }
    }
  }

  await prisma.$transaction([
    prisma.goal.update({
      where: { id: goalId },
      data: {
        feasibilityScore: score,
        feasibilityStatus: status,
        feasibilityReason: reason,
        feasibilityUpdatedAt: new Date(),
        progressPercent,
      },
    }),
    prisma.goalFeasibilityLog.create({
      data: { goalId, score, status, reason, source: FeasibilitySource.SYSTEM },
    }),
  ]);

  return { score, status, reason, progressPercent };
}

type GoalLike = { status: string; feasibilityStatus: FeasibilityStatus };

/** Paused/completed goals show as "unknown" (tracking paused) regardless
 * of their last computed feasibility status - matches the design. */
export function feasibilityBucket(goal: GoalLike) {
  if (goal.status === "PAUSED") return { bucket: "unknown" as const, label: "Paused" };
  if (goal.status === "COMPLETED") return { bucket: "unknown" as const, label: "Completed" };
  switch (goal.feasibilityStatus) {
    case FeasibilityStatus.ON_TRACK:
      return { bucket: "onTrack" as const, label: "On track" };
    case FeasibilityStatus.AT_RISK:
      return { bucket: "atRisk" as const, label: "At risk" };
    case FeasibilityStatus.UNREALISTIC:
      return { bucket: "unrealistic" as const, label: "Unrealistic" };
    default:
      return { bucket: "unknown" as const, label: "Unknown" };
  }
}

export function deadlineLabel(deadline: Date | null): string {
  if (!deadline) return "No deadline";
  const days = Math.ceil((deadline.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export function statusLabel(status: string): string {
  return { ACTIVE: "Active", PAUSED: "Paused", DROPPED: "Dropped", COMPLETED: "Completed" }[status] ?? status;
}
