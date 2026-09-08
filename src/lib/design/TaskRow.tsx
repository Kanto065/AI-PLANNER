"use client";

import { useTransition } from "react";
import { Blueprint } from "./Blueprint";
import { startTimer, pauseTimer, completeTask, skipTask } from "@/lib/actions/tasks";

export type TaskRowData = {
  id: string;
  title: string;
  timeRange: string;
  goalTitle: string | null;
  isRoutine: boolean;
  difficulty: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  isRunning: boolean;
  runningLabel: string | null;
};

export function TaskRow({ task }: { task: TaskRowData }) {
  const [pending, startTransitionFn] = useTransition();

  const run = (fn: () => Promise<void>) => () => startTransitionFn(async () => { await fn(); });

  return (
    <Blueprint className="flex items-start gap-3.5 p-3.5" style={{ background: "var(--color-bg)", opacity: pending ? 0.6 : 1 }}>
      <div className="text-muted flex-shrink-0" style={{ width: 76, fontSize: 12, lineHeight: 1.4, paddingTop: 2 }}>
        {task.timeRange}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div style={{ fontWeight: 500, fontSize: 15 }}>{task.title}</div>
          {task.goalTitle ? <span className="tag tag-accent">{task.goalTitle}</span> : null}
          {task.isRoutine ? <span className="tag tag-neutral">Routine</span> : null}
        </div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <div className="flex gap-0.5" title="Difficulty">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                style={{ width: 5, height: 5, borderRadius: "50%", background: i < task.difficulty ? "var(--color-accent)" : "var(--color-divider)" }}
              />
            ))}
          </div>
          {task.isRunning && task.runningLabel ? (
            <span className="text-muted" style={{ fontSize: 12, color: "var(--color-accent)", fontFamily: "var(--font-heading)" }}>
              {task.runningLabel} elapsed
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-shrink-0 gap-1.5">
        {task.status === "PENDING" && (
          <>
            <button className="btn btn-secondary" onClick={run(() => startTimer(task.id))} disabled={pending} style={{ padding: "6px 10px", fontSize: 12, display: "flex", gap: 5 }} type="button">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l14 8-14 8z" /></svg>
              Start
            </button>
            <button className="btn btn-icon btn-secondary" onClick={run(() => skipTask(task.id))} disabled={pending} title="Skip" style={{ padding: 6 }} type="button">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </>
        )}
        {task.status === "IN_PROGRESS" && (
          <>
            <button className="btn btn-secondary" onClick={run(() => pauseTimer(task.id))} disabled={pending} style={{ padding: "6px 10px", fontSize: 12, display: "flex", gap: 5 }} type="button">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 4h3v16H7zM14 4h3v16h-3z" /></svg>
              Pause
            </button>
            <button className="btn btn-primary" onClick={run(() => completeTask(task.id))} disabled={pending} style={{ padding: "6px 10px", fontSize: 12 }} type="button">
              Complete
            </button>
          </>
        )}
        {task.status === "COMPLETED" && <span className="tag tag-outline">Done</span>}
        {task.status === "SKIPPED" && <span className="tag tag-neutral">Skipped</span>}
      </div>
    </Blueprint>
  );
}
