"use client";

import { useState, useTransition } from "react";
import { Blueprint } from "./Blueprint";
import { createGoal, updateGoal } from "@/lib/actions/goals";

export type GoalFormInitial = {
  id?: string;
  title: string;
  description: string;
  category: string;
  estimatedHours: string;
  deadline: string; // yyyy-mm-dd
};

export function GoalFormModal({ initial, onClose }: { initial: GoalFormInitial; onClose: () => void }) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState(initial.category);
  const [estimatedHours, setEstimatedHours] = useState(initial.estimatedHours);
  const [deadline, setDeadline] = useState(initial.deadline);
  const [pending, startTransition] = useTransition();

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
        <div className="field mb-4">
          <label>Deadline (optional)</label>
          <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={pending || !title.trim()} type="button">Save goal</button>
        </div>
      </Blueprint>
    </div>
  );
}
