"use client";

import { useState } from "react";
import { TaskFormModal, type TaskFormGoalOption } from "./TaskFormModal";

export function AddTaskButton({ scheduledDate, goals, className, style }: {
  scheduledDate: string;
  goals: TaskFormGoalOption[];
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={className ?? "btn btn-primary"} style={style ?? { margin: "0 auto" }} onClick={() => setOpen(true)} type="button">
        Add a task
      </button>
      {open && <TaskFormModal scheduledDate={new Date(scheduledDate)} goals={goals} onClose={() => setOpen(false)} />}
    </>
  );
}
