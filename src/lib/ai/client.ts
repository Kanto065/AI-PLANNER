import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type TriageMessage = { role: "user" | "assistant"; text: string };

export type GoalActionProposal = { kind: "goal_action"; goalId: string; action: "pause" | "drop" | "merge" | "note"; text: string };

export type GoalPlanProposal = {
  kind: "goal_plan";
  title: string;
  description?: string;
  category?: string;
  estimatedHours?: number | null;
  deadline?: string | null; // ISO yyyy-mm-dd
  weekdays: number[]; // 0-6, [] = every day
  sessionMinutes: number;
  preferredStartMinutes: number; // minutes since local midnight
  text: string;
};

export type TaskCreateProposal = {
  kind: "task_create";
  title: string;
  scheduledDate: string; // ISO yyyy-mm-dd
  scheduledStartMinutes?: number | null;
  durationMinutes?: number | null;
  goalId?: string | null;
  text: string;
};

export type TriageProposal = GoalActionProposal | GoalPlanProposal | TaskCreateProposal;
export type TriageReply = { reply: string; proposal?: TriageProposal; provider?: "groq" | "gemini" };

export type GoalContext = {
  id: string;
  title: string;
  status: string;
  feasibilityStatus: string;
  feasibilityScore: number | null;
  feasibilityReason: string | null;
};

function systemPrompt(goals: GoalContext[]) {
  const goalsBlock = goals.length
    ? goals
        .map(
          (g) =>
            `- ${g.title} (id: ${g.id}, status: ${g.status}, feasibility: ${g.feasibilityStatus}${g.feasibilityScore != null ? ` score ${g.feasibilityScore}` : ""}) — ${g.feasibilityReason ?? "no assessment yet"}`,
        )
        .join("\n")
    : "(no active goals yet)";

  return `You are Steady's triage assistant, built into a personal daily planner. The user talks through what's on their mind about their goals and workload. Be honest and direct, not falsely encouraging - if a goal isn't feasible given the real numbers below, say so plainly and explain why using those numbers.

The user's current goals (real data, not invented):
${goalsBlock}

You can propose exactly one of three kinds of change per turn. Always include "kind" in the proposal.

1. Changing an EXISTING goal (pausing it, dropping it, merging it with another, or leaving a note): reference its exact id from the list above, never invent one.
{"reply": "...", "proposal": {"kind": "goal_action", "goalId": "...", "action": "pause|drop|merge|note", "text": "one sentence describing the proposed change"}}

2. Creating a brand-new goal with a recurring commitment plan, when the user describes a new goal they want to start tracking (not a change to an existing one):
{"reply": "...", "proposal": {"kind": "goal_plan", "title": "...", "description": "...", "category": "...", "estimatedHours": <number or null>, "deadline": "<yyyy-mm-dd or null>", "weekdays": [0-6 ints, Sun=0; empty array means every day], "sessionMinutes": <int>, "preferredStartMinutes": <int, minutes since midnight>, "text": "one sentence summary"}}

3. Creating a single one-off task, optionally linked to one of the goals listed above by id:
{"reply": "...", "proposal": {"kind": "task_create", "title": "...", "scheduledDate": "<yyyy-mm-dd>", "scheduledStartMinutes": <int or null>, "durationMinutes": <int or null>, "goalId": "<existing id or null>", "text": "one sentence summary"}}

Required fields before you may emit a "goal_plan" proposal: title, which days (or every day), session length, a preferred time, AND a deadline and/or total estimated hours - a recurring plan is never allowed to have neither. Required fields before you may emit a "task_create" proposal: title and a date.

If the user is clearly asking to create a new goal or task but ANY required field above is missing or ambiguous, do NOT emit a proposal this turn. Instead, in "reply", ask a short clarifying question AND suggest a specific, reasonable default for each missing piece (e.g. "I'd suggest 1-hour sessions starting at 6pm - want me to use that, or something else?") so the user can just say yes. Only emit the proposal once you have every required field, either from what the user said or from them accepting your suggested defaults.

Never apply any change yourself - only propose it; the user must explicitly confirm. Omit the "proposal" key entirely when you're just asking a clarifying question or there's nothing to propose. Respond with ONLY a JSON object, no other text, in exactly one of the shapes above.`;
}

function parseReply(raw: string): TriageReply {
  try {
    // Models sometimes wrap JSON in a code fence despite instructions.
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.reply === "string") {
      return { reply: parsed.reply, proposal: parsed.proposal };
    }
  } catch {
    // fall through to plain-text fallback below
  }
  return { reply: raw };
}

async function tryGroq(messages: TriageMessage[], goals: GoalContext[]): Promise<TriageReply> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
  const completion = await client.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: systemPrompt(goals) },
      ...messages.map((m) => ({ role: m.role, content: m.text }) as const),
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Groq returned no content");
  return parseReply(content);
}

async function tryGemini(messages: TriageMessage[], goals: GoalContext[]): Promise<TriageReply> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const history = messages.slice(0, -1).map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] }));
  const last = messages[messages.length - 1];

  const chat = model.startChat({ history, systemInstruction: systemPrompt(goals) });
  const result = await chat.sendMessage(last.text);
  return parseReply(result.response.text());
}

/** Groq primary, Gemini fallback. Throws only if both are unconfigured or
 * both fail - callers should show a clear "AI provider unavailable"
 * message rather than a fake canned reply. */
export async function generateTriageReply(messages: TriageMessage[], goals: GoalContext[]): Promise<TriageReply> {
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);

  if (!hasGroq && !hasGemini) {
    throw new Error("NOT_CONFIGURED");
  }

  if (hasGroq) {
    try {
      const result = await tryGroq(messages, goals);
      return { ...result, provider: "groq" };
    } catch (err) {
      console.error("[ai] Groq failed, falling back to Gemini:", err);
      if (!hasGemini) throw err;
    }
  }

  const result = await tryGemini(messages, goals);
  return { ...result, provider: "gemini" };
}
