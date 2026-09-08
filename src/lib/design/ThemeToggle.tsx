"use client";

import { useEffect, useState } from "react";

function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Small hook so both the header icon-toggle and Settings' segmented
 * control stay in sync without prop-drilling. */
export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Intentional: syncs from the DOM attribute the pre-hydration inline
    // script (see layout.tsx) already applied from localStorage. Reading
    // it during render instead would mismatch the server-rendered HTML,
    // which always assumes "light".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(currentTheme());
  }, []);

  const apply = (next: "light" | "dark") => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // localStorage unavailable (private mode, etc.) - theme just won't persist.
    }
    setTheme(next);
  };

  return { theme, setLight: () => apply("light"), setDark: () => apply("dark"), toggle: () => apply(theme === "dark" ? "light" : "dark") };
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button className="btn btn-icon" onClick={toggle} title="Toggle theme" type="button">
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
