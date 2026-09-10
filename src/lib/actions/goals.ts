"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "./require-user";
import { recalculateFeasibility } from "@/lib/feasibility";
import { GoalStatus, FeasibilitySource } from "@prisma/client";
import { startOfDay } from "@/lib/date-utils";
import { computePlanOccurrences, validatePlanInput, type PlanInput } from "@/lib/plan";

function revalidateAll() {
  revalidatePath("/goals");
  revalidatePath("/today");
  revalidatePath("/stats");
}

export async function createGoal(input: {
  title: string;
  description?: string;
  category?: string;
  estimatedHours?: number | null;
  deadline?: Date | null;
}) {
  const userId = await requireUserId();
  const goal = await prisma.goal.create({
    data: {
      userId,
      title: input.title,
      description: input.description || null,
      category: input.category || "Personal",
      estimatedHours: input.estimatedHours ?? null,
      deadline: input.deadline ?? null,
    },
  });
  await recalculateFeasibility(goal.id);
  revalidateAll();
  return goal.id;
}

export async function updateGoal(
  goalId: string,
  input: {
    title: string;
    description?: string;
    category?: string;
    estimatedHours?: number | null;
    deadline?: Date | null;
  },
) {
  await requireUserId();
  await prisma.goal.update({
    where: { id: goalId },
    data: {
      title: input.title,
      description: input.description || null,
      category: input.category || undefined,
      estimatedHours: input.estimatedHours ?? null,
      deadline: input.deadline ?? null,
    },
  });
  await recalculateFeasibility(goalId);
  revalidateAll();
}

export async function setGoalStatus(goalId: string, status: GoalStatus) {
  await requireUserId();
  await prisma.goal.update({ where: { id: goalId }, data: { status } });
  revalidateAll();
}

/** Applies a confirmed triage proposal to a goal. "merge" and "note" don't
 * have a clean structural representation in the schema (a real merge needs
 * two goals; the schema tracks one per proposal), so both are recorded as
 * an annotation on the goal, same as a manual override but attributed to
 * the triage session instead. */
export async function applyTriageAction(goalId: string, action: "pause" | "drop" | "merge" | "note", text: string) {
  await requireUserId();

  if (action === "pause") {
    await prisma.goal.update({ where: { id: goalId }, data: { status: GoalStatus.PAUSED } });
  } else if (action === "drop") {
    await prisma.goal.update({ where: { id: goalId }, data: { status: GoalStatus.DROPPED } });
  }

  const goal = await prisma.goal.update({
    where: { id: goalId },
    data: { feasibilityOverride: true, feasibilityOverrideNote: text },
  });

  await prisma.goalFeasibilityLog.create({
    data: { goalId, score: goal.feasibilityScore, status: goal.feasibilityStatus, reason: text, source: FeasibilitySource.TRIAGE },
  });

  revalidateAll();
}

/** An annotation layered on top of the live automatic assessment, not a
 * replacement - recalculateFeasibility keeps running normally afterward. */
export async function submitOverride(goalId: string, note: string) {
  await requireUserId();
  if (!note.trim()) return;

  const goal = await prisma.goal.update({
    where: { id: goalId },
    data: { feasibilityOverride: true, feasibilityOverrideNote: note },
  });

  await prisma.goalFeasibilityLog.create({
    data: {
      goalId,
      score: goal.feasibilityScore,
      status: goal.feasibilityStatus,
      reason: note,
      source: FeasibilitySource.USER_OVERRIDE,
    },
  });

  revalidateAll();
}

const WEEKDAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export type PlanPreviewInput = {
  weekdays: number[];
  sessionMinutes: number;
  preferredStartMinutes: number;
  deadline: Date | null;
  estimatedHours: number | null;
};

export type PlanPreview =
  | { ok: true; occurrences: { dateIso: string; startIso: string; endIso: string }[]; sessionCount: number; totalHours: number; lastDateIso: string | null }
  | { ok: false; errors: string[] };

/** Read-only: computes what a plan WOULD create, no DB writes. Used for
 * both the manual GoalFormModal preview step and the Triage AI's plan
 * proposal card - the same computation createGoalWithPlan re-runs on
 * confirm, so the previewed numbers are always what actually gets made. */
export async function previewGoalPlan(input: PlanPreviewInput): Promise<PlanPreview> {
  await requireUserId();

  const planInput: PlanInput = {
    startDate: startOfDay(new Date()),
    weekdays: input.weekdays,
    sessionMinutes: input.sessionMinutes,
    preferredStartMinutes: input.preferredStartMinutes,
    deadline: input.deadline,
    estimatedHours: input.estimatedHours,
  };

  const errors = validatePlanInput(planInput);
  if (errors.length) return { ok: false, errors };

  const result = computePlanOccurrences(planInput);
  return {
    ok: true,
    occurrences: result.occurrences.map((o) => ({
      dateIso: o.date.toISOString(),
      startIso: o.start.toISOString(),
      endIso: o.end.toISOString(),
    })),
    sessionCount: result.sessionCount,
    totalHours: result.totalHours,
    lastDateIso: result.lastDate ? result.lastDate.toISOString() : null,
  };
}

export type CreateGoalPlanInput = {
  title: string;
  description?: string;
  category?: string;
  estimatedHours?: number | null;
  deadline?: Date | null;
  weekdays: number[];
  sessionMinutes: number;
  preferredStartMinutes: number;
};

/** Creates the Goal plus every planned Task row in one transaction. Always
 * re-validates and re-computes occurrences from the raw input server-side -
 * never trusts a client-echoed preview. */
export async function createGoalWithPlan(input: CreateGoalPlanInput): Promise<{ goalId: string; sessionCount: number }> {
  const userId = await requireUserId();

  const planInput: PlanInput = {
    startDate: startOfDay(new Date()),
    weekdays: input.weekdays,
    sessionMinutes: input.sessionMinutes,
    preferredStartMinutes: input.preferredStartMinutes,
    deadline: input.deadline ?? null,
    estimatedHours: input.estimatedHours ?? null,
  };

  const errors = validatePlanInput(planInput);
  if (errors.length) throw new Error("INVALID_PLAN: " + errors.join("; "));

  const { occurrences } = computePlanOccurrences(planInput);
  if (occurrences.length === 0) {
    throw new Error("INVALID_PLAN: no sessions fall within the given pattern/end condition");
  }

  const recurrenceRule = input.weekdays.length === 0 ? "daily" : `weekly:${input.weekdays.map((d) => WEEKDAY_ABBR[d]).join(",")}`;

  const goalId = await prisma.$transaction(async (tx) => {
    const goal = await tx.goal.create({
      data: {
        userId,
        title: input.title,
        description: input.description || null,
        category: input.category || "Personal",
        estimatedHours: input.estimatedHours ?? null,
        deadline: input.deadline ?? null,
        planWeekdays: input.weekdays,
        planSessionMinutes: input.sessionMinutes,
        planPreferredStartMinutes: input.preferredStartMinutes,
      },
    });

    await tx.task.createMany({
      data: occurrences.map((o) => ({
        userId,
        goalId: goal.id,
        title: input.title,
        scheduledDate: o.date,
        scheduledStart: o.start,
        scheduledEnd: o.end,
        isRoutine: true,
        recurrenceRule,
        difficulty: 1,
      })),
    });

    return goal.id;
  });

  // recalculateFeasibility runs its own top-level transaction - call it
  // after this one commits rather than nesting it.
  await recalculateFeasibility(goalId);
  revalidateAll();

  return { goalId, sessionCount: occurrences.length };
}
