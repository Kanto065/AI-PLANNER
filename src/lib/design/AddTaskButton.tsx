"use client";

import { useTransition } from "react";
import { createTask } from "@/lib/actions/tasks";

export function AddTaskButton({ scheduledDate }: { scheduledDate: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn btn-primary"
      style={{ margin: "0 auto" }}
      disabled={pending}
      type="button"
      onClick={() =>
        startTransition(async () => {
          const date = new Date(scheduledDate);
          const start = new Date();
          start.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
          const end = new Date(start.getTime() + 30 * 60_000);
          await createTask({ title: "New task", scheduledDate: date, scheduledStart: start, scheduledEnd: end });
        })
      }
    >
      Add a task
    </button>
  );
}
