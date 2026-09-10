"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "./require-user";
import { generateTriageReply, type TriageMessage, type GoalActionProposal, type GoalPlanProposal, type TaskCreateProposal } from "@/lib/ai/client";
import { applyTriageAction, createGoalWithPlan } from "./goals";
import { createTask } from "./tasks";
import { sanitizeAiGoalPlanProposal, sanitizeAiTaskCreateProposal } from "@/lib/plan";
import { GoalStatus, Prisma } from "@prisma/client";

type ProposalStatus = "pending" | "confirmed" | "rejected";

export type StoredMessage = {
  role: "user" | "assistant" | "system";
  text: string;
  proposal?:
    | (GoalActionProposal & { status: ProposalStatus })
    | (GoalPlanProposal & { status: ProposalStatus })
    | (TaskCreateProposal & { status: ProposalStatus });
};

function summarize(messages: StoredMessage[]) {
  const firstUser = messages.find((m) => m.role === "user");
  const text = firstUser?.text ?? "Triage session";
  return text.length > 90 ? text.slice(0, 87) + "…" : text;
}

export async function sendTriageMessage(sessionId: string | null, userText: string) {
  const userId = await requireUserId();
  if (!userText.trim()) return { sessionId, messages: [] as StoredMessage[] };

  let session = sessionId
    ? await prisma.conversationSummary.findFirst({ where: { id: sessionId, userId } })
    : null;

  const existingMessages: StoredMessage[] = (session?.messages as StoredMessage[] | null) ?? [];
  const messages: StoredMessage[] = [...existingMessages, { role: "user", text: userText }];

  const goals = await prisma.goal.findMany({
    where: { userId, status: GoalStatus.ACTIVE },
    select: { id: true, title: true, status: true, feasibilityStatus: true, feasibilityScore: true, feasibilityReason: true },
  });

  let model = session?.model ?? "";
  try {
    const aiMessages: TriageMessage[] = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", text: m.text }));

    const result = await generateTriageReply(aiMessages, goals);
    model = result.provider ?? model;

    let proposal: StoredMessage["proposal"];
    if (result.proposal?.kind === "goal_action") {
      proposal = { ...result.proposal, status: "pending" };
    } else if (result.proposal?.kind === "goal_plan") {
      const sanitized = sanitizeAiGoalPlanProposal(result.proposal);
      if (sanitized) proposal = { ...sanitized, status: "pending" };
    } else if (result.proposal?.kind === "task_create") {
      const sanitized = sanitizeAiTaskCreateProposal(result.proposal);
      if (sanitized) proposal = { ...sanitized, status: "pending" };
    }

    messages.push({ role: "assistant", text: result.reply, proposal });
  } catch (err) {
    const message = err instanceof Error && err.message === "NOT_CONFIGURED"
      ? "AI provider not configured yet — add GROQ_API_KEY (or GEMINI_API_KEY) to enable real replies."
      : "The AI provider is unavailable right now — try again in a moment.";
    messages.push({ role: "system", text: message });
  }

  const data = {
    userId,
    rawInput: messages.map((m) => `${m.role}: ${m.text}`).join("\n"),
    summary: summarize(messages),
    actions: (session ? (session.actions as Prisma.InputJsonValue) : []) as Prisma.InputJsonValue,
    model: model || "none",
    messages: messages as unknown as Prisma.InputJsonValue,
  };

  session = session
    ? await prisma.conversationSummary.update({ where: { id: session.id }, data })
    : await prisma.conversationSummary.create({ data });

  revalidatePath("/triage");
  return { sessionId: session.id, messages };
}

export async function respondToProposal(sessionId: string, messageIndex: number, decision: "confirm" | "reject") {
  const userId = await requireUserId();
  const session = await prisma.conversationSummary.findFirst({ where: { id: sessionId, userId } });
  if (!session) return { messages: [] as StoredMessage[] };

  const messages = [...((session.messages as StoredMessage[] | null) ?? [])];
  const msg = messages[messageIndex];
  if (!msg?.proposal || msg.proposal.status !== "pending") return { sessionId, messages };

  let confirmError: string | null = null;
  let confirmedSessionCount: number | null = null;

  if (decision === "confirm") {
    try {
      if (msg.proposal.kind === "goal_action") {
        await applyTriageAction(msg.proposal.goalId, msg.proposal.action, msg.proposal.text);
      } else if (msg.proposal.kind === "goal_plan") {
        const p = msg.proposal;
        const result = await createGoalWithPlan({
          title: p.title,
          description: p.description,
          category: p.category,
          estimatedHours: p.estimatedHours ?? null,
          deadline: p.deadline ? new Date(p.deadline + "T00:00:00") : null,
          weekdays: p.weekdays,
          sessionMinutes: p.sessionMinutes,
          preferredStartMinutes: p.preferredStartMinutes,
        });
        confirmedSessionCount = result.sessionCount;
      } else if (msg.proposal.kind === "task_create") {
        const p = msg.proposal;
        const [y, m, d] = p.scheduledDate.split("-").map(Number);
        const scheduled = new Date(y, (m || 1) - 1, d || 1);
        const start = p.scheduledStartMinutes != null ? new Date(scheduled.getTime() + p.scheduledStartMinutes * 60_000) : null;
        const end = start && p.durationMinutes ? new Date(start.getTime() + p.durationMinutes * 60_000) : null;
        await createTask({ title: p.title, scheduledDate: scheduled, scheduledStart: start, scheduledEnd: end, goalId: p.goalId ?? null });
      }
    } catch (err) {
      confirmError = err instanceof Error ? err.message.replace(/^INVALID_PLAN:\s*/, "") : "Couldn't apply that change.";
    }
  }

  const finalStatus: ProposalStatus = decision === "confirm" && !confirmError ? "confirmed" : "rejected";
  messages[messageIndex] = { ...msg, proposal: { ...msg.proposal, status: finalStatus } } as StoredMessage;

  if (confirmError) {
    messages.push({ role: "system", text: `Couldn't create that: ${confirmError}` });
  } else if (decision === "confirm") {
    const confirmedText = msg.proposal.kind === "goal_plan"
      ? `Applied: goal + ${confirmedSessionCount} session${confirmedSessionCount === 1 ? "" : "s"} created.`
      : msg.proposal.kind === "task_create"
        ? "Applied: task created."
        : "Applied: goal updated.";
    messages.push({ role: "system", text: confirmedText });
  } else {
    messages.push({ role: "system", text: "Dismissed — no changes made." });
  }

  const actions = (session.actions as { goalId?: string; action: string; decision: string; appliedAt: string }[]) ?? [];
  if (decision === "confirm" && !confirmError) {
    actions.push({
      goalId: "goalId" in msg.proposal ? msg.proposal.goalId ?? undefined : undefined,
      action: msg.proposal.kind,
      decision,
      appliedAt: new Date().toISOString(),
    });
  }

  await prisma.conversationSummary.update({
    where: { id: session.id },
    data: {
      messages: messages as unknown as Prisma.InputJsonValue,
      actions: actions as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/triage");
  revalidatePath("/goals");
  revalidatePath("/today");
  return { sessionId, messages };
}
