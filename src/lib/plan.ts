// Pure plan-computation logic: turns a recurring commitment pattern into a
// concrete list of task occurrences. Nothing here touches Prisma or the
// network - there is no engine anywhere that expands a recurrence rule at
// read time, so every occurrence produced here must be materialized as a
// real Task row by the caller (src/lib/actions/goals.ts).
import { addDays, addMinutes, startOfDay } from "./date-utils";

export type PlanInput = {
  startDate: Date; // first calendar day eligible for a session
  weekdays: number[]; // 0=Sun..6=Sat; [] = every day
  sessionMinutes: number;
  preferredStartMinutes: number; // minutes since local midnight
  deadline: Date | null; // inclusive last eligible calendar day
  estimatedHours: number | null; // generation stops once cumulative hours reach this
};

export type PlanOccurrence = { date: Date; start: Date; end: Date };

export type PlanComputation = {
  occurrences: PlanOccurrence[];
  totalHours: number;
  sessionCount: number;
  lastDate: Date | null;
};

const MAX_DAYS_SCANNED = 3650; // ~10 years, safety cap
const MAX_OCCURRENCES = 2000;

export function computePlanOccurrences(input: PlanInput): PlanComputation {
  const occurrences: PlanOccurrence[] = [];
  const deadlineDay = input.deadline ? startOfDay(input.deadline) : null;
  const start = startOfDay(input.startDate);

  for (let i = 0; i < MAX_DAYS_SCANNED && occurrences.length < MAX_OCCURRENCES; i++) {
    const day = addDays(start, i);
    if (deadlineDay && day.getTime() > deadlineDay.getTime()) break;

    const qualifies = input.weekdays.length === 0 || input.weekdays.includes(day.getDay());
    if (!qualifies) continue;

    const sessionStart = addMinutes(day, input.preferredStartMinutes);
    const sessionEnd = addMinutes(sessionStart, input.sessionMinutes);
    occurrences.push({ date: day, start: sessionStart, end: sessionEnd });

    if (input.estimatedHours != null) {
      const cumulativeHours = (occurrences.length * input.sessionMinutes) / 60;
      if (cumulativeHours >= input.estimatedHours) break;
    }
  }

  return {
    occurrences,
    sessionCount: occurrences.length,
    totalHours: (occurrences.length * input.sessionMinutes) / 60,
    lastDate: occurrences.length ? occurrences[occurrences.length - 1].date : null,
  };
}

export function validatePlanInput(input: PlanInput): string[] {
  const errors: string[] = [];

  if (!input.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    errors.push("Weekdays must each be between 0 (Sun) and 6 (Sat).");
  }
  if (!(input.sessionMinutes > 0 && input.sessionMinutes <= 24 * 60)) {
    errors.push("Session length must be more than 0 and at most 24 hours.");
  }
  if (!(input.preferredStartMinutes >= 0 && input.preferredStartMinutes <= 1439)) {
    errors.push("Preferred start time must be a valid time of day.");
  }
  if (input.deadline == null && input.estimatedHours == null) {
    errors.push("Add a deadline and/or estimated hours so the plan has a defined end.");
  }
  if (input.deadline != null) {
    if (isNaN(input.deadline.getTime())) {
      errors.push("Deadline is not a valid date.");
    } else if (startOfDay(input.deadline).getTime() < startOfDay(input.startDate).getTime()) {
      errors.push("Deadline can't be before the start date.");
    }
  }
  if (input.estimatedHours != null && !(input.estimatedHours > 0)) {
    errors.push("Estimated hours must be greater than 0.");
  }

  return errors;
}

// --- AI proposal shapes + defensive validation -----------------------------
// The Groq/Gemini triage client (src/lib/ai/client.ts) gets structured
// output purely by prompt instruction - there is no function-calling/JSON
// schema mode anywhere in this codebase, so anything the model emits must
// be treated as untrusted input and validated here before it's ever shown
// to the user as a confirmable proposal.

export type GoalPlanProposal = {
  kind: "goal_plan";
  title: string;
  description?: string;
  category?: string;
  estimatedHours?: number | null;
  deadline?: string | null; // ISO yyyy-mm-dd
  weekdays: number[];
  sessionMinutes: number;
  preferredStartMinutes: number;
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

export function sanitizeAiGoalPlanProposal(raw: unknown): GoalPlanProposal | null {
  if (!isPlainObject(raw) || raw.kind !== "goal_plan") return null;
  if (typeof raw.title !== "string" || !raw.title.trim() || raw.title.length > 200) return null;
  if (typeof raw.text !== "string" || !raw.text.trim()) return null;

  if (!Array.isArray(raw.weekdays) || !raw.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return null;
  if (typeof raw.sessionMinutes !== "number" || !(raw.sessionMinutes > 0 && raw.sessionMinutes <= 1440)) return null;
  if (typeof raw.preferredStartMinutes !== "number" || !(raw.preferredStartMinutes >= 0 && raw.preferredStartMinutes <= 1439)) return null;

  const deadline = raw.deadline;
  if (deadline != null && !isValidIsoDate(deadline)) return null;

  const estimatedHours = raw.estimatedHours;
  if (estimatedHours != null && !(typeof estimatedHours === "number" && estimatedHours > 0)) return null;

  if (deadline == null && estimatedHours == null) return null; // required end condition

  return {
    kind: "goal_plan",
    title: raw.title.trim(),
    description: typeof raw.description === "string" ? raw.description : undefined,
    category: typeof raw.category === "string" ? raw.category : undefined,
    estimatedHours: (estimatedHours as number | null) ?? null,
    deadline: (deadline as string | null) ?? null,
    weekdays: raw.weekdays as number[],
    sessionMinutes: raw.sessionMinutes,
    preferredStartMinutes: raw.preferredStartMinutes,
    text: raw.text.trim(),
  };
}

export function sanitizeAiTaskCreateProposal(raw: unknown): TaskCreateProposal | null {
  if (!isPlainObject(raw) || raw.kind !== "task_create") return null;
  if (typeof raw.title !== "string" || !raw.title.trim() || raw.title.length > 200) return null;
  if (typeof raw.text !== "string" || !raw.text.trim()) return null;
  if (!isValidIsoDate(raw.scheduledDate)) return null;

  const startMinutes = raw.scheduledStartMinutes;
  if (startMinutes != null && !(typeof startMinutes === "number" && startMinutes >= 0 && startMinutes <= 1439)) return null;

  const duration = raw.durationMinutes;
  if (duration != null && !(typeof duration === "number" && duration > 0 && duration <= 1440)) return null;

  const goalId = raw.goalId;
  if (goalId != null && typeof goalId !== "string") return null;

  return {
    kind: "task_create",
    title: raw.title.trim(),
    scheduledDate: raw.scheduledDate as string,
    scheduledStartMinutes: (startMinutes as number | null) ?? null,
    durationMinutes: (duration as number | null) ?? null,
    goalId: (goalId as string | null) ?? null,
    text: raw.text.trim(),
  };
}
