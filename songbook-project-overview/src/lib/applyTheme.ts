import { COLOR_THEMES } from "./types";
import { deriveSecondary, ensureReadableOnWhiteText, normaliseHex } from "./color";

export function resolveAccentColors(theme: string, customColor: string): [string, string] {
  if (theme === "custom") {
    const normalised = normaliseHex(customColor) || "#2a7de1";
    const safe = ensureReadableOnWhiteText(normalised);
    return [safe, deriveSecondary(safe)];
  }
  const found = COLOR_THEMES[theme];
  if (found) return found;
  return COLOR_THEMES.ocean;
}

export function applyThemeToDocument(mode: "light" | "dark", theme: string, customColor: string) {
  const root = document.documentElement;
  root.setAttribute("data-mode", mode);
  const [a1, a2] = resolveAccentColors(theme, customColor);
  root.style.setProperty("--accent-1", a1);
  root.style.setProperty("--accent-2", a2);
  root.style.setProperty("--accent", a1);

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", mode === "dark" ? "#0a0c12" : "#eef2f8");
}
