"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "./require-user";
import { generateTriageReply, type TriageMessage } from "@/lib/ai/client";
import { applyTriageAction } from "./goals";
import { GoalStatus, Prisma } from "@prisma/client";

export type StoredMessage = {
  role: "user" | "assistant" | "system";
  text: string;
  proposal?: {
    goalId: string;
    action: "pause" | "drop" | "merge" | "note";
    text: string;
    status: "pending" | "confirmed" | "rejected";
  };
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

    messages.push({
      role: "assistant",
      text: result.reply,
      proposal: result.proposal ? { ...result.proposal, status: "pending" } : undefined,
    });
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

  if (decision === "confirm") {
    await applyTriageAction(msg.proposal.goalId, msg.proposal.action, msg.proposal.text);
  }
  messages[messageIndex] = { ...msg, proposal: { ...msg.proposal, status: decision === "confirm" ? "confirmed" : "rejected" } };
  messages.push({ role: "system", text: decision === "confirm" ? "Applied: goal updated." : "Dismissed — no changes made." });

  const actions = (session.actions as { goalId: string; action: string; decision: string; appliedAt: string }[]) ?? [];
  if (decision === "confirm") {
    actions.push({ goalId: msg.proposal.goalId, action: msg.proposal.action, decision, appliedAt: new Date().toISOString() });
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
  return { sessionId, messages };
}
