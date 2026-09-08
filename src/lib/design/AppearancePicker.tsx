"use client";

import { useTheme } from "./ThemeToggle";

export function AppearancePicker() {
  const { theme, setLight, setDark } = useTheme();
  return (
    <div className="seg">
      <button className="seg-opt" data-selected={theme === "light"} onClick={setLight} style={{ padding: "7px 14px", fontSize: 13 }} type="button">Light</button>
      <button className="seg-opt" data-selected={theme === "dark"} onClick={setDark} style={{ padding: "7px 14px", fontSize: 13 }} type="button">Dark</button>
    </div>
  );
}
