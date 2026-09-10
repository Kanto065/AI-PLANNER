"use client";

import { useState } from "react";
import Link from "next/link";
import { Blueprint } from "./Blueprint";
import { getMonthGrid, toDateKey } from "@/lib/date-utils";

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CalendarPicker({ selectedDate, today }: { selectedDate: Date; today: Date }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(selectedDate.getFullYear());
  const [month, setMonth] = useState(selectedDate.getMonth());

  const weeks = getMonthGrid(year, month);
  const selectedKey = toDateKey(selectedDate);
  const todayKey = toDateKey(today);

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  return (
    <>
      <button className="btn btn-icon btn-secondary" onClick={() => setOpen(true)} title="Calendar" style={{ padding: 6 }} type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="17" rx="1" /><path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
      </button>

      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <Blueprint as="div" className="dialog p-5.5" style={{ width: "min(340px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3.5 flex items-center justify-between">
              <button className="btn btn-icon btn-secondary" onClick={() => shiftMonth(-1)} style={{ padding: 6 }} type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 5l-7 7 7 7" /></svg>
              </button>
              <h4 className="m-0">{new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h4>
              <button className="btn btn-icon btn-secondary" onClick={() => shiftMonth(1)} style={{ padding: 6 }} type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <div className="mb-1 grid grid-cols-7 gap-1">
              {DAY_NAMES.map((n) => (
                <div key={n} className="text-muted text-center" style={{ fontSize: 11 }}>{n}</div>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {weeks.map((week, i) => (
                <div key={i} className="grid grid-cols-7 gap-1">
                  {week.map((d) => {
                    const key = toDateKey(d);
                    const inMonth = d.getMonth() === month;
                    const isSelected = key === selectedKey;
                    const isToday = key === todayKey;
                    return (
                      <Link
                        key={key}
                        href={`/today?date=${key}`}
                        onClick={() => setOpen(false)}
                        className="text-center"
                        style={{
                          padding: "6px 0",
                          textDecoration: "none",
                          fontSize: 13,
                          fontWeight: isToday ? 700 : 400,
                          color: isSelected ? "var(--color-bg)" : inMonth ? "inherit" : "var(--color-neutral-400, #999)",
                          background: isSelected ? "var(--color-accent)" : "transparent",
                        }}
                      >
                        {d.getDate()}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </Blueprint>
        </div>
      )}
    </>
  );
}
