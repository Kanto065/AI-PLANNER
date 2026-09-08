"use client";

import { useState, useTransition } from "react";
import { Blueprint } from "./Blueprint";
import { setGoalStatus } from "@/lib/actions/goals";
import { GoalStatus } from "@prisma/client";
import { GoalFormModal, type GoalFormInitial } from "./GoalFormModal";
import { OverrideModal } from "./OverrideModal";

export type GoalDetailData = {
  id: string;
  title: string;
  category: string | null;
  statusLabel: string;
  status: GoalStatus;
  description: string | null;
  estimatedHours: number | null;
  deadlineIso: string | null;
  loggedHours: number;
  estHours: number | null;
  deadlineLabel: string;
  progressPercent: number;
  feasBucket: "onTrack" | "atRisk" | "unrealistic" | "unknown";
  feasOverridden: boolean;
  feasScore: number | null;
  feasReason: string | null;
  overrideNote: string | null;
  history: { date: string; label: string }[];
  linkedTasks: { title: string; statusLabel: string }[];
};

export function GoalDetailPanel({ goal }: { goal: GoalDetailData }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const setStatus = (status: GoalStatus) => startTransition(async () => { await setGoalStatus(goal.id, status); });

  const editInitial: GoalFormInitial = {
    id: goal.id,
    title: goal.title,
    description: goal.description ?? "",
    category: goal.category ?? "",
    estimatedHours: goal.estimatedHours != null ? String(goal.estimatedHours) : "",
    deadline: goal.deadlineIso ?? "",
  };

  const feasBg = goal.feasBucket === "atRisk" || goal.feasBucket === "unrealistic" ? "var(--color-accent-100)" : "var(--color-bg)";

  return (
    <Blueprint className="p-5.5" style={{ background: "var(--color-bg)", opacity: pending ? 0.6 : 1 }}>
      <div className="mb-1.5 flex items-start justify-between gap-2.5">
        <div>
          <h3 className="mb-1.5">{goal.title}</h3>
          <span className="tag tag-neutral">{goal.category}</span>{" "}
          <span className="tag tag-outline">{goal.statusLabel}</span>
        </div>
        <button className="btn btn-icon btn-secondary flex-shrink-0" onClick={() => setEditing(true)} title="Edit" style={{ padding: 6 }} type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 20l1-4L16 5l3 3L8 19z" /></svg>
        </button>
      </div>
      {goal.description ? <p className="text-muted my-2.5" style={{ fontSize: 13 }}>{goal.description}</p> : null}

      <div className="my-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-muted mb-1" style={{ fontSize: 12 }}>Logged / estimated</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18 }}>
            {goal.loggedHours.toFixed(1)}h / {goal.estHours ?? "—"}h
          </div>
        </div>
        <div>
          <div className="text-muted mb-1" style={{ fontSize: 12 }}>Deadline</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18 }}>{goal.deadlineLabel}</div>
        </div>
      </div>
      <div className="mb-5" style={{ height: 6, background: "var(--color-divider)" }}>
        <div style={{ height: "100%", background: "var(--color-accent)", width: `${goal.progressPercent}%` }} />
      </div>

      <Blueprint className="mb-4 p-3.5" style={{ background: feasBg }}>
        <div className="mb-2 flex items-center gap-2">
          {goal.feasBucket === "onTrack" && <span className="tag tag-outline">On track</span>}
          {goal.feasBucket === "atRisk" && <span className="tag" style={{ background: "var(--color-accent-200)", color: "var(--color-accent-800)" }}>At risk</span>}
          {goal.feasBucket === "unrealistic" && <span className="tag" style={{ background: "var(--color-accent-800)", color: "var(--color-bg)" }}>Unrealistic</span>}
          {goal.feasOverridden && <span className="tag tag-neutral">Manually overridden</span>}
          <span className="text-muted" style={{ fontSize: 12 }}>score {goal.feasScore ?? "—"}</span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>{goal.feasReason}</div>
        {goal.overrideNote ? (
          <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "var(--color-divider)" }}>
            <div className="text-muted mb-1" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Your note</div>
            <div style={{ fontSize: 13 }}>{goal.overrideNote}</div>
          </div>
        ) : null}
        <button className="btn btn-ghost mt-2.5" onClick={() => setOverriding(true)} style={{ fontSize: 12, padding: 0 }} type="button">
          Override this assessment
        </button>
      </Blueprint>

      {goal.history.length > 0 && (
        <div className="mb-4">
          <h6 className="mb-2.5">Feasibility history</h6>
          <div className="flex flex-col gap-2">
            {goal.history.map((h, i) => (
              <div key={i} className="flex gap-2.5" style={{ fontSize: 13 }}>
                <span className="text-muted flex-shrink-0" style={{ width: 70 }}>{h.date}</span>
                <span>{h.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {goal.linkedTasks.length > 0 && (
        <div className="mb-5">
          <h6 className="mb-2.5">Linked tasks</h6>
          <div className="flex flex-col gap-1.5">
            {goal.linkedTasks.map((t, i) => (
              <div key={i} className="flex justify-between" style={{ fontSize: 13 }}>
                <span>{t.title}</span>
                <span className="text-muted">{t.statusLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: "var(--color-divider)" }}>
        {goal.status === "ACTIVE" && (
          <button className="btn btn-secondary" onClick={() => setStatus(GoalStatus.PAUSED)} disabled={pending} style={{ fontSize: 13 }} type="button">Pause</button>
        )}
        {goal.status === "PAUSED" && (
          <button className="btn btn-secondary" onClick={() => setStatus(GoalStatus.ACTIVE)} disabled={pending} style={{ fontSize: 13 }} type="button">Resume</button>
        )}
        {goal.status === "ACTIVE" && (
          <button className="btn btn-primary" onClick={() => setStatus(GoalStatus.COMPLETED)} disabled={pending} style={{ fontSize: 13 }} type="button">Mark complete</button>
        )}
        {(goal.status === "ACTIVE" || goal.status === "PAUSED") && (
          <button className="btn btn-ghost" onClick={() => setStatus(GoalStatus.DROPPED)} disabled={pending} style={{ fontSize: 13 }} type="button">Drop goal</button>
        )}
      </div>

      {editing && <GoalFormModal initial={editInitial} onClose={() => setEditing(false)} />}
      {overriding && <OverrideModal goalId={goal.id} goalTitle={goal.title} onClose={() => setOverriding(false)} />}
    </Blueprint>
  );
}
