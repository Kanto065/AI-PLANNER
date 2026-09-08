"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "./require-user";
import { xpForTask } from "@/lib/xp";
import { recomputeStreaks } from "@/lib/streaks";
import { recalculateFeasibility } from "@/lib/feasibility";
import { TaskStatus } from "@prisma/client";

const PATHS = ["/today", "/stats", "/goals"] as const;
function revalidateAll() {
  for (const p of PATHS) revalidatePath(p);
}

/** Only one timer may run at a time across the whole app (single-user,
 * matches the design's single global timer pill). */
export async function startTimer(taskId: string) {
  const userId = await requireUserId();

  const openLog = await prisma.timeLog.findFirst({ where: { userId, endedAt: null } });
  if (openLog) {
    await prisma.timeLog.update({
      where: { id: openLog.id },
      data: { endedAt: new Date(), durationSeconds: Math.round((Date.now() - openLog.startedAt.getTime()) / 1000) },
    });
  }

  await prisma.timeLog.create({ data: { taskId, userId, startedAt: new Date() } });
  await prisma.task.update({ where: { id: taskId }, data: { status: TaskStatus.IN_PROGRESS } });

  revalidateAll();
}

export async function pauseTimer(taskId: string) {
  const userId = await requireUserId();
  const openLog = await prisma.timeLog.findFirst({ where: { userId, taskId, endedAt: null } });
  if (openLog) {
    await prisma.timeLog.update({
      where: { id: openLog.id },
      data: { endedAt: new Date(), durationSeconds: Math.round((Date.now() - openLog.startedAt.getTime()) / 1000) },
    });
  }
  revalidateAll();
}

export async function completeTask(taskId: string) {
  const userId = await requireUserId();

  const openLog = await prisma.timeLog.findFirst({ where: { userId, taskId, endedAt: null } });
  if (openLog) {
    await prisma.timeLog.update({
      where: { id: openLog.id },
      data: { endedAt: new Date(), durationSeconds: Math.round((Date.now() - openLog.startedAt.getTime()) / 1000) },
    });
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
  });

  await prisma.userStats.upsert({
    where: { userId },
    create: { userId, xp: xpForTask(task.difficulty) },
    update: { xp: { increment: xpForTask(task.difficulty) } },
  });

  await recomputeStreaks(userId);
  if (task.goalId) await recalculateFeasibility(task.goalId);

  revalidateAll();
}

export async function skipTask(taskId: string) {
  const userId = await requireUserId();
  await prisma.task.update({ where: { id: taskId }, data: { status: TaskStatus.SKIPPED } });
  await recomputeStreaks(userId);
  revalidateAll();
}

export async function createTask(input: {
  title: string;
  scheduledDate: Date;
  scheduledStart?: Date | null;
  scheduledEnd?: Date | null;
  goalId?: string | null;
  isRoutine?: boolean;
  difficulty?: number;
}) {
  const userId = await requireUserId();
  await prisma.task.create({
    data: {
      userId,
      title: input.title,
      scheduledDate: input.scheduledDate,
      scheduledStart: input.scheduledStart ?? null,
      scheduledEnd: input.scheduledEnd ?? null,
      goalId: input.goalId ?? null,
      isRoutine: input.isRoutine ?? false,
      difficulty: input.difficulty ?? 1,
    },
  });
  revalidateAll();
}
