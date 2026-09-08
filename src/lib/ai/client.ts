import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type TriageMessage = { role: "user" | "assistant"; text: string };
export type TriageProposal = { goalId: string; action: "pause" | "drop" | "merge" | "note"; text: string };
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

If, and only if, the conversation clearly calls for changing a specific goal (pausing it, dropping it, merging it with another, or just leaving a note on it), include a "proposal" referencing its exact id from the list above. Never invent a goalId that isn't listed. Never apply a change yourself - only propose it; the user must explicitly confirm.

Respond with ONLY a JSON object, no other text, in exactly this shape:
{"reply": "your response text", "proposal": {"goalId": "...", "action": "pause|drop|merge|note", "text": "one sentence describing the proposed change"}}
Omit the "proposal" key entirely if no change is warranted.`;
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
