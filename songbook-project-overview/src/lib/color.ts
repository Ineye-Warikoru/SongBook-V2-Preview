export function normaliseHex(input: string): string | null {
  let hex = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex.toLowerCase()}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [rl, gl, bl] = [toLin(r), toLin(g), toLin(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Darkens a colour if it's too light for white button text to stay readable on it. */
export function ensureReadableOnWhiteText(hex: string): string {
  let color = hex;
  let guard = 0;
  while (relativeLuminance(color) > 0.55 && guard < 8) {
    color = darken(color, 0.12);
    guard++;
  }
  return color;
}

export function deriveSecondary(hex: string): string {
  return darken(hex, 0.22);
}
