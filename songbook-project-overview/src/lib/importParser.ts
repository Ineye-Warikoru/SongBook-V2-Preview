export interface ParsedVersion {
  title: string;
  key: string | null;
  capo: number | null;
  kind: "chords" | "score";
  fileName: string;
  label: string;
}

const STOP_WORDS = new Set(["chords", "chord", "score", "sheet", "music", "lead", "key"]);

const NOTE_RE = /^[A-G](#|b|sharp|flat)?m?$/i;

function titleCaseWord(word: string): string {
  if (!word) return word;
  if (/^[A-Z0-9]+$/.test(word) && word.length <= 4) return word; // keep acronyms
  return word;
}

function normaliseNote(token: string): string | null {
  const m = token.match(/^([A-Ga-g])(#|b|sharp|flat)?(m)?$/);
  if (!m) return null;
  let note = m[1].toUpperCase();
  if (m[2]) {
    if (/sharp/i.test(m[2])) note += "#";
    else if (/flat/i.test(m[2])) note += "b";
    else note += m[2];
  }
  if (m[3]) note += "m";
  return note;
}

export function parsePdfFileName(rawName: string): ParsedVersion {
  let name = rawName.trim();
  try {
    name = decodeURIComponent(name);
  } catch {
    // ignore decode errors, use as-is
  }
  name = name.replace(/\.pdf$/i, "");
  name = name.replace(/_/g, "-");
  name = name.replace(/\s+/g, "-");

  const tokens = name.split("-").filter(Boolean);

  let key: string | null = null;
  let capo: number | null = null;
  let kind: "chords" | "score" = "score";
  const keep: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const lower = tok.toLowerCase();

    if (lower === "capo" && i + 1 < tokens.length && /^\d+$/.test(tokens[i + 1])) {
      capo = parseInt(tokens[i + 1], 10);
      i++;
      continue;
    }

    if (lower === "chords" || lower === "chord") {
      kind = "chords";
      // "Chords-in-E"
      if (tokens[i + 1] && tokens[i + 1].toLowerCase() === "in" && tokens[i + 2]) {
        const n = normaliseNote(tokens[i + 2]);
        if (n) {
          key = n;
          i += 2;
          continue;
        }
      }
      continue;
    }

    if (lower === "key" && tokens[i + 1]) {
      const n = normaliseNote(tokens[i + 1]);
      if (n) {
        key = n;
        kind = "chords";
        i++;
        continue;
      }
    }

    if (lower === "score" || lower === "sheet" || lower === "music") {
      kind = kind === "chords" ? kind : "score";
      continue;
    }

    keep.push(tok);
  }

  // Check trailing lone letter as key, e.g. "Above-All-G"
  if (!key && keep.length > 1) {
    const last = keep[keep.length - 1];
    const n = normaliseNote(last);
    if (n && last.length <= 3) {
      key = n;
      kind = "chords";
      keep.pop();
    }
  }

  const title = keep
    .map(titleCaseWord)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  let label: string;
  if (kind === "chords") {
    label = key ? `Chords in ${key}` : "Chords";
    if (capo) label += ` capo ${capo}`;
  } else {
    label = "Score";
  }

  return {
    title: title || rawName.replace(/\.pdf$/i, ""),
    key,
    capo,
    kind,
    fileName: rawName,
    label,
  };
}

export function letterForTitle(title: string): string {
  const ch = title.trim().charAt(0).toUpperCase();
  if (/[0-9]/.test(ch)) return "#";
  if (/[A-Z]/.test(ch)) return ch;
  return "#";
}

export function extractPdfNames(pasted: string): string[] {
  const results = new Set<string>();

  // Matches URLs or bare filenames ending in .pdf
  const re = /([A-Za-z0-9%_.\-\/:]+?\.pdf)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(pasted)) !== null) {
    let candidate = match[1];
    // take only the last path segment
    const parts = candidate.split("/");
    candidate = parts[parts.length - 1];
    if (candidate.length > 3) {
      results.add(candidate);
    }
  }

  return Array.from(results);
}

export function normaliseSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
