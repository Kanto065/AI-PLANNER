"use client";

import { useState } from "react";
import { GoalFormModal } from "./GoalFormModal";

export function NewGoalButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)} style={{ display: "flex", gap: 6, fontSize: 13 }} type="button">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
        New goal
      </button>
      {open && (
        <GoalFormModal
          initial={{ title: "", description: "", category: "", estimatedHours: "", deadline: "" }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
