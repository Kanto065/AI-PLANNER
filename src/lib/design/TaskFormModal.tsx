"use client";

import { useState, useTransition } from "react";
import { Blueprint } from "./Blueprint";
import { createTask } from "@/lib/actions/tasks";
import { toDateKey } from "@/lib/date-utils";

export type TaskFormGoalOption = { id: string; title: string };

export function TaskFormModal({
  scheduledDate,
  goals,
  onClose,
}: {
  scheduledDate: Date;
  goals: TaskFormGoalOption[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toDateKey(scheduledDate));
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [goalId, setGoalId] = useState("");
  const [difficulty, setDifficulty] = useState("1");
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const [y, m, d] = date.split("-").map(Number);
      const [h, min] = startTime.split(":").map(Number);
      const scheduled = new Date(y, (m || 1) - 1, d || 1);
      const start = new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0);
      const end = new Date(start.getTime() + Number(durationMinutes) * 60_000);

      await createTask({
        title,
        scheduledDate: scheduled,
        scheduledStart: start,
        scheduledEnd: end,
        goalId: goalId || null,
        difficulty: Number(difficulty),
      });
      onClose();
    });
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <Blueprint as="div" className="dialog p-5.5" onClick={(e) => e.stopPropagation()}>
        <h4 className="mb-3.5">New task</h4>
        <div className="field mb-2.5">
          <label>Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
        <div className="mb-2.5 grid grid-cols-2 gap-2.5">
          <div className="field">
            <label>Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Start time</label>
            <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
        </div>
        <div className="mb-2.5 grid grid-cols-2 gap-2.5">
          <div className="field">
            <label>Duration (minutes)</label>
            <input className="input" type="number" min="1" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
          </div>
          <div className="field">
            <label>Difficulty</label>
            <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field mb-4">
          <label>Goal (optional)</label>
          <select className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">No goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={pending || !title.trim()} type="button">Add task</button>
        </div>
      </Blueprint>
    </div>
  );
}
