"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { href: "/today", label: "Today" },
  { href: "/goals", label: "Goals" },
  { href: "/triage", label: "Triage" },
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
] as const;

const TAB_ICONS: Record<string, ReactNode> = {
  "/today": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="17" rx="1" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  ),
  "/goals": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),
  "/triage": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 12a8.5 8.5 0 1 1-3.6-7L21 4l-1 4.5A8.4 8.4 0 0 1 21 12z" />
    </svg>
  ),
  "/stats": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2c1.5 3 5 5.5 5 10a5 5 0 1 1-10 0c0-1.5.5-2.5 1.3-3.4C8.7 10 9 12 10 12c-.3-3 1-6 2-10z" />
    </svg>
  ),
  "/settings": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  ),
};

function fmtElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type OpenTimer = { taskId: string; taskTitle: string; startedAt: string } | null;

function TimerPill({ timer }: { timer: OpenTimer }) {
  const [elapsed, setElapsed] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!timer) return;
    const started = new Date(timer.startedAt).getTime();
    const tick = () => setElapsed(Math.round((Date.now() - started) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer]);

  if (!timer) return null;

  return (
    <button
      className="btn btn-secondary"
      onClick={() => router.push("/today")}
      style={{ borderColor: "var(--color-accent)" }}
      type="button"
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "var(--color-accent)",
          animation: "tickPulse 1.4s infinite",
        }}
      />
      <span className="text-muted" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text)" }}>
        {timer.taskTitle}
      </span>
      <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>{fmtElapsed(elapsed)}</span>
    </button>
  );
}

export function AppShell({ children, timer }: { children: ReactNode; timer: OpenTimer }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href === "/goals" && pathname?.startsWith("/goals"));

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
      <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b px-4 py-3" style={{ borderColor: "var(--color-divider)" }}>
        <div className="flex min-w-0 items-center gap-4">
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 19 }}>AI Planner</div>
          <nav className="hidden md:flex gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="btn"
                style={{
                  fontSize: 13,
                  padding: "7px 12px",
                  color: isActive(item.href) ? "var(--color-bg)" : "var(--color-text)",
                  background: isActive(item.href) ? "var(--color-accent)" : "transparent",
                  borderColor: isActive(item.href) ? "var(--color-accent)" : "transparent",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2.5">
          <TimerPill timer={timer} />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6" style={{ maxWidth: 1080, margin: "0 auto", width: "100%" }}>
        {children}
      </div>

      <nav className="flex flex-shrink-0 border-t md:hidden" style={{ borderColor: "var(--color-divider)", background: "var(--color-bg)" }}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-1 flex-col items-center gap-1 py-2.5"
            style={{ color: isActive(item.href) ? "var(--color-accent)" : "color-mix(in srgb, var(--color-text) 55%, transparent)" }}
          >
            {TAB_ICONS[item.href]}
            <span style={{ fontSize: 10 }}>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
