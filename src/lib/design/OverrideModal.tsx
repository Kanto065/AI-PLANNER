"use client";

import { useState, useTransition } from "react";
import { Blueprint } from "./Blueprint";
import { submitOverride } from "@/lib/actions/goals";

export function OverrideModal({
  goalId,
  goalTitle,
  onClose,
}: {
  goalId: string;
  goalTitle: string;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (!note.trim()) return;
    startTransition(async () => {
      await submitOverride(goalId, note);
      onClose();
    });
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <Blueprint as="div" className="dialog p-5.5" onClick={(e) => e.stopPropagation()}>
        <h4 className="mb-1.5">Override feasibility</h4>
        <div className="text-muted mb-3.5" style={{ fontSize: 13 }}>
          {goalTitle} — explain why you&apos;re overriding the automatic assessment.
        </div>
        <textarea
          className="input"
          style={{ width: "100%", minHeight: 90, resize: "vertical" }}
          placeholder="e.g. Deprioritized after triage — treating as a stretch goal, not on critical path."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose} disabled={pending} type="button">Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={pending || !note.trim()} type="button">Save override</button>
        </div>
      </Blueprint>
    </div>
  );
}
