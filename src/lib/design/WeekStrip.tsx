import Link from "next/link";
import { toDateKey } from "@/lib/date-utils";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekStrip({
  weekDays,
  selectedDate,
  today,
  countsByDate,
}: {
  weekDays: Date[];
  selectedDate: Date;
  today: Date;
  countsByDate: Record<string, number>;
}) {
  const selectedKey = toDateKey(selectedDate);
  const todayKey = toDateKey(today);

  return (
    <div className="flex gap-1.5">
      {weekDays.map((d) => {
        const key = toDateKey(d);
        const isSelected = key === selectedKey;
        const isToday = key === todayKey;
        const count = countsByDate[key] ?? 0;
        return (
          <Link
            key={key}
            href={`/today?date=${key}`}
            className="flex flex-1 flex-col items-center gap-1 p-2"
            style={{
              textDecoration: "none",
              color: "inherit",
              border: "1px solid var(--color-divider)",
              background: isSelected ? "var(--color-accent)" : "var(--color-bg)",
            }}
          >
            <span className="text-muted" style={{ fontSize: 10, color: isSelected ? "var(--color-bg)" : undefined }}>{DAY_NAMES[d.getDay()]}</span>
            <span style={{ fontSize: 15, fontWeight: isToday ? 700 : 500, color: isSelected ? "var(--color-bg)" : undefined }}>{d.getDate()}</span>
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: count > 0 ? (isSelected ? "var(--color-bg)" : "var(--color-accent)") : "transparent",
              }}
            />
          </Link>
        );
      })}
    </div>
  );
}
