"use client";

import { useState, useTransition } from "react";
import { Blueprint } from "./Blueprint";
import { createGoal, updateGoal, previewGoalPlan, createGoalWithPlan, type PlanPreview } from "@/lib/actions/goals";
import { timeStringToMinutes, formatHM } from "@/lib/date-utils";

export type GoalFormInitial = {
  id?: string;
  title: string;
  description: string;
  category: string;
  estimatedHours: string;
  deadline: string; // yyyy-mm-dd
};

const WEEKDAYS = [
  { value: 0, label: "Su" },
  { value: 1, label: "Mo" },
  { value: 2, label: "Tu" },
  { value: 3, label: "We" },
  { value: 4, label: "Th" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
];

type FormStep = "form" | "preview";

export function GoalFormModal({ initial, onClose }: { initial: GoalFormInitial; onClose: () => void }) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState(initial.category);
  const [estimatedHours, setEstimatedHours] = useState(initial.estimatedHours);
  const [deadline, setDeadline] = useState(initial.deadline);
  const [pending, startTransition] = useTransition();

  // Recurring plan fields - only meaningful (and only sent) when `recurring`
  // is on. `weekdays: []` means "every day".
  const [recurring, setRecurring] = useState(false);
  const [everyDay, setEveryDay] = useState(true);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [sessionMinutes, setSessionMinutes] = useState("60");
  const [preferredStart, setPreferredStart] = useState("09:00");

  const [step, setStep] = useState<FormStep>("form");
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const hasEndCondition = Boolean(estimatedHours) || Boolean(deadline);
  const canPreview = title.trim() && hasEndCondition && (everyDay || weekdays.length > 0) && Number(sessionMinutes) > 0;

  const toggleWeekday = (d: number) => {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const planFields = () => ({
    weekdays: everyDay ? [] : weekdays,
    sessionMinutes: Number(sessionMinutes),
    preferredStartMinutes: timeStringToMinutes(preferredStart),
    deadline: deadline ? new Date(deadline + "T00:00:00") : null,
    estimatedHours: estimatedHours ? Number(estimatedHours) : null,
  });

  const save = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const payload = {
        title,
        description,
        category,
        estimatedHours: estimatedHours ? Number(estimatedHours) : null,
        deadline: deadline ? new Date(deadline + "T00:00:00") : null,
      };
      if (initial.id) await updateGoal(initial.id, payload);
      else await createGoal(payload);
      onClose();
    });
  };

  const goToPreview = () => {
    if (!canPreview) return;
    startTransition(async () => {
      const result = await previewGoalPlan(planFields());
      setPreview(result);
      if (result.ok) {
        setErrors([]);
        setStep("preview");
      } else {
        setErrors(result.errors);
      }
    });
  };

  const confirmCreate = () => {
    startTransition(async () => {
      try {
        await createGoalWithPlan({ title, description, category, ...planFields() });
        onClose();
      } catch (err) {
        setErrors([err instanceof Error ? err.message.replace(/^INVALID_PLAN:\s*/, "") : "Couldn't create the plan."]);
        setStep("form");
      }
    });
  };

  if (step === "preview" && preview?.ok) {
    const shown = preview.occurrences.slice(0, 10);
    return (
      <div className="dialog-backdrop" onClick={onClose}>
        <Blueprint as="div" className="dialog p-5.5" onClick={(e) => e.stopPropagation()}>
          <h4 className="mb-1">Review plan</h4>
          <div className="text-muted mb-3.5" style={{ fontSize: 13 }}>
            {preview.sessionCount} sessions of {sessionMinutes} min &middot; {preview.totalHours.toFixed(1)}h total
            {preview.lastDateIso ? ` · through ${new Date(preview.lastDateIso).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
          </div>
          <div className="mb-4 flex flex-col gap-1.5" style={{ maxHeight: 220, overflowY: "auto" }}>
            {shown.map((o, i) => (
              <div key={i} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                <span>{new Date(o.dateIso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                <span className="text-muted">{formatHM(new Date(o.startIso))}&ndash;{formatHM(new Date(o.endIso))}</span>
              </div>
            ))}
            {preview.sessionCount > shown.length && (
              <div className="text-muted" style={{ fontSize: 12 }}>+{preview.sessionCount - shown.length} more</div>
            )}
          </div>
          {errors.length > 0 && (
            <div className="mb-3" style={{ fontSize: 12, color: "var(--color-accent-800)" }}>
              {errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setStep("form")} disabled={pending} type="button">Back to edit</button>
            <button className="btn btn-primary" onClick={confirmCreate} disabled={pending} type="button">Confirm and create</button>
          </div>
        </Blueprint>
      </div>
    );
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <Blueprint as="div" className="dialog p-5.5" onClick={(e) => e.stopPropagation()}>
        <h4 className="mb-3.5">{initial.id ? "Edit goal" : "New goal"}</h4>
        <div className="field mb-2.5">
          <label>Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field mb-2.5">
          <label>Description</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="mb-2.5 grid grid-cols-2 gap-2.5">
          <div className="field">
            <label>Category</label>
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="field">
            <label>Est. hours</label>
            <input className="input" type="number" min="0" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} />
          </div>
        </div>
        <div className="field mb-3.5">
          <label>Deadline (optional)</label>
          <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>

        {!initial.id && (
          <div className="mb-4">
            <label className="flex items-center gap-2" style={{ fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
              Make this a recurring plan
            </label>

            {recurring && (
              <div className="mt-3 flex flex-col gap-2.5">
                <div className="seg">
                  <button type="button" className="seg-opt" data-selected={everyDay} onClick={() => setEveryDay(true)}>Every day</button>
                  <button type="button" className="seg-opt" data-selected={!everyDay} onClick={() => setEveryDay(false)}>Specific days</button>
                </div>

                {!everyDay && (
                  <div className="seg">
                    {WEEKDAYS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        className="seg-opt"
                        data-selected={weekdays.includes(d.value)}
                        onClick={() => toggleWeekday(d.value)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="field">
                    <label>Minutes per session</label>
                    <input className="input" type="number" min="1" value={sessionMinutes} onChange={(e) => setSessionMinutes(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Preferred start time</label>
                    <input className="input" type="time" value={preferredStart} onChange={(e) => setPreferredStart(e.target.value)} />
                  </div>
                </div>

                {!hasEndCondition && (
                  <div style={{ fontSize: 12, color: "var(--color-accent-800)" }}>
                    Add a deadline and/or estimated hours so the plan has a defined end.
                  </div>
                )}
                {errors.length > 0 && (
                  <div style={{ fontSize: 12, color: "var(--color-accent-800)" }}>
                    {errors.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose} disabled={pending} type="button">Cancel</button>
          {recurring && !initial.id ? (
            <button className="btn btn-primary" onClick={goToPreview} disabled={pending || !canPreview} type="button">Preview plan</button>
          ) : (
            <button className="btn btn-primary" onClick={save} disabled={pending || !title.trim()} type="button">Save goal</button>
          )}
        </div>
      </Blueprint>
    </div>
  );
}
