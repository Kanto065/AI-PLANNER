"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "./require-user";
import { recalculateFeasibility } from "@/lib/feasibility";
import { GoalStatus, FeasibilitySource } from "@prisma/client";

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
