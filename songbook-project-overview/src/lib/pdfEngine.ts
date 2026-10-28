import type { PDFDocumentProxy, PDFPageProxy, TextItem } from "pdfjs-dist/types/src/display/api";
import { isChordLine, isChordToken, transposeChordText } from "./chordEngine";

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsLibPromise;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function loadPdfDocument(base64: string): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  const bytes = base64ToUint8Array(base64);
  if (bytes.length === 0) {
    throw new Error("Couldn't read that PDF");
  }
  // Pass a fresh copy; pdf.js may transfer/detach the underlying buffer.
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    standardFontDataUrl: "/standard_fonts/",
  });
  try {
    return await loadingTask.promise;
  } catch (err) {
    console.error("pdf.js failed to load document", err);
    throw new Error("Couldn't read that PDF");
  }
}

export interface PositionedItem {
  text: string;
  x: number;
  y: number; // baseline, canvas pixel coords (top-down)
  width: number;
  heightPx: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
}

export interface LineInfo {
  items: PositionedItem[];
  isChord: boolean;
}

interface RawItem extends PositionedItem {}

export async function extractLines(
  page: PDFPageProxy,
  viewport: { width: number; height: number; transform: number[] },
): Promise<LineInfo[]> {
  const pdfjs = await getPdfjs();
  const textContent = await page.getTextContent();
  const styles = textContent.styles || {};

  const raw: RawItem[] = [];
  for (const it of textContent.items as TextItem[]) {
    if (!("str" in it) || !it.str || !it.str.trim()) continue;
    const combined = pdfjs.Util.transform(viewport.transform as unknown as number[], it.transform as unknown as number[]);
    const a = combined[0];
    const b = combined[1];
    const c = combined[2];
    const d = combined[3];
    const x = combined[4];
    const y = combined[5];
    const heightPx = Math.hypot(b, d) || Math.abs(d) || 10;
    const widthPx = Math.hypot(a, c) * (it.width || 0) || it.str.length * heightPx * 0.55;

    const style = styles[(it as unknown as { fontName: string }).fontName] as
      | { fontFamily?: string }
      | undefined;
    const famRaw = (style && style.fontFamily) || "sans-serif";
    const bold = /bold/i.test(famRaw) || /bold/i.test((it as unknown as { fontName: string }).fontName || "");
    const italic = /italic|oblique/i.test(famRaw);
    const fontFamily = /serif/i.test(famRaw) && !/sans/i.test(famRaw) ? "serif" : "sans-serif";

    raw.push({ text: it.str, x, y, width: widthPx, heightPx, fontFamily, bold, italic });
  }

  if (raw.length === 0) return [];

  // --- Column detection: look for an empty vertical strip in the middle band of the page.
  const pageWidth = viewport.width;
  const binCount = 80;
  const coverage = new Array(binCount).fill(0);
  for (const item of raw) {
    const startBin = Math.max(0, Math.floor((item.x / pageWidth) * binCount));
    const endBin = Math.min(binCount - 1, Math.floor(((item.x + item.width) / pageWidth) * binCount));
    for (let i = startBin; i <= endBin; i++) coverage[i]++;
  }
  let gapStart = -1;
  let gapEnd = -1;
  const loBound = Math.floor(binCount * 0.25);
  const hiBound = Math.floor(binCount * 0.75);
  for (let i = loBound; i <= hiBound; i++) {
    if (coverage[i] === 0) {
      if (gapStart === -1) gapStart = i;
      gapEnd = i;
    } else if (gapStart !== -1 && gapEnd - gapStart < 2) {
      // reset short gaps
      gapStart = -1;
      gapEnd = -1;
    }
  }
  let splitX: number | null = null;
  if (gapStart !== -1 && gapEnd - gapStart >= 2) {
    const leftHasContent = coverage.slice(0, gapStart).some((v) => v > 0);
    const rightHasContent = coverage.slice(gapEnd + 1).some((v) => v > 0);
    if (leftHasContent && rightHasContent) {
      splitX = ((gapStart + gapEnd) / 2 / binCount) * pageWidth;
    }
  }

  const columns: RawItem[][] = splitX
    ? [raw.filter((it) => it.x < splitX!), raw.filter((it) => it.x >= splitX!)]
    : [raw];

  const lines: LineInfo[] = [];
  for (const colItems of columns) {
    if (colItems.length === 0) continue;
    const sorted = [...colItems].sort((a, b) => a.y - b.y || a.x - b.x);
    const groups: RawItem[][] = [];
    for (const item of sorted) {
      let placed = false;
      for (const group of groups) {
        const ref = group[0];
        const tolerance = Math.max(3, ref.heightPx * 0.4);
        if (Math.abs(ref.y - item.y) <= tolerance) {
          group.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) groups.push([item]);
    }
    for (const group of groups) {
      group.sort((a, b) => a.x - b.x);
      const joined = group.map((g) => g.text).join(" ");
      lines.push({ items: group, isChord: isChordLine(joined) });
    }
  }

  return lines;
}

function pixelKey(r: number, g: number, b: number) {
  return `${r},${g},${b}`;
}

function sampleBoxColors(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): { bg: string; fg: string } {
  const px = Math.max(0, Math.floor(x));
  const py = Math.max(0, Math.floor(y));
  const pw = Math.max(1, Math.ceil(w));
  const ph = Math.max(1, Math.ceil(h));
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(px, py, pw, ph).data;
  } catch {
    return { bg: "#ffffff", fg: "#111111" };
  }

  const counts = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4) {
    const key = pixelKey(data[i], data[i + 1], data[i + 2]);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let bgKey = "255,255,255";
  let bgCount = -1;
  for (const [key, count] of counts.entries()) {
    if (count > bgCount) {
      bgCount = count;
      bgKey = key;
    }
  }
  const [br, bgc, bb] = bgKey.split(",").map(Number);

  let fgKey = bgKey;
  let maxDist = -1;
  for (const [key] of counts.entries()) {
    const [r, g, b] = key.split(",").map(Number);
    const dist = Math.abs(r - br) + Math.abs(g - bgc) + Math.abs(b - bb);
    if (dist > maxDist) {
      maxDist = dist;
      fgKey = key;
    }
  }
  const [fr, fg, fb] = fgKey.split(",").map(Number);

  return {
    bg: `rgb(${br},${bgc},${bb})`,
    fg: maxDist > 30 ? `rgb(${fr},${fg},${fb})` : "rgb(17,17,17)",
  };
}

export function paintTransposedChords(
  ctx: CanvasRenderingContext2D,
  sourceCtx: CanvasRenderingContext2D,
  lines: LineInfo[],
  semitones: number,
  targetKey: string,
) {
  for (const line of lines) {
    if (!line.isChord) continue;
    for (const item of line.items) {
      if (!isChordToken(item.text) && !/^\(.*\)\.?$/.test(item.text)) continue;
      const newText = transposeChordText(item.text, semitones, targetKey);
      if (newText === item.text && semitones === 0) continue;

      const pad = 1;
      const boxX = item.x - pad;
      const boxY = item.y - item.heightPx * 1.05;
      const boxW = item.width + pad * 2;
      const boxH = item.heightPx * 1.3;

      const { bg, fg } = sampleBoxColors(sourceCtx, boxX, boxY, boxW, boxH);

      ctx.save();
      ctx.fillStyle = bg;
      ctx.fillRect(boxX, boxY, boxW, boxH);

      let fontSize = item.heightPx * 0.92;
      const weight = item.bold ? "bold" : "normal";
      const style = item.italic ? "italic" : "normal";
      ctx.font = `${style} ${weight} ${fontSize}px ${item.fontFamily}`;
      const measured = ctx.measureText(newText).width;
      if (measured > 0 && item.width > 0) {
        const scaleFactor = Math.min(1.3, Math.max(0.6, item.width / measured));
        fontSize *= scaleFactor;
        ctx.font = `${style} ${weight} ${fontSize}px ${item.fontFamily}`;
      }
      ctx.fillStyle = fg;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(newText, item.x, item.y);
      ctx.restore();
    }
  }
}

export function collectChordTokens(lines: LineInfo[]): string[] {
  const tokens: string[] = [];
  for (const line of lines) {
    if (!line.isChord) continue;
    for (const item of line.items) {
      if (isChordToken(item.text)) tokens.push(item.text);
    }
  }
  return tokens;
}
