// Core music-theory engine: chord recognition, transposition and key detection.

export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// Keys that conventionally use flats.
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Dm", "Gm", "Cm", "Fm", "Bbm"]);

const NOTE_TO_INDEX: Record<string, number> = {
  "C": 0, "B#": 0,
  "C#": 1, "Db": 1,
  "D": 2,
  "D#": 3, "Eb": 3,
  "E": 4, "Fb": 4,
  "F": 5, "E#": 5,
  "F#": 6, "Gb": 6,
  "G": 7,
  "G#": 8, "Ab": 8,
  "A": 9,
  "A#": 10, "Bb": 10,
  "B": 11, "Cb": 11,
};

export const SECTION_WORDS = [
  "intro", "verse", "chorus", "bridge", "pre-chorus", "prechorus", "outro",
  "interlude", "tag", "ending", "turnaround", "instrumental", "coda", "refrain",
];

const SEPARATOR_RE = /^(\|{1,2}|\/{1,4}|x\d+|%|-{2,}|\.{2,})$/i;

// A-G, optional accidental, optional quality, optional bracketed extension, optional slash bass.
const CHORD_CORE =
  "[A-G](?:#|b|♯|♭)?(?:maj|Maj|MAJ|min|Min|MIN|m|M|dim|Dim|aug|Aug|sus|Sus|add|Add)?\\d{0,2}\\+?\\d{0,2}(?:\\((?:add)?\\d+\\))?(?:\\/[A-G](?:#|b|♯|♭)?)?";

const CHORD_RE = new RegExp(`^\\(?${CHORD_CORE}\\)?\\.?$`);

export function normaliseAccidentals(token: string): string {
  return token.replace(/♯/g, "#").replace(/♭/g, "b");
}

export function isChordToken(raw: string): boolean {
  if (!raw) return false;
  const token = normaliseAccidentals(raw.trim());
  if (!token) return false;
  if (SEPARATOR_RE.test(token)) return false;
  return CHORD_RE.test(token);
}

export function isSeparatorToken(raw: string): boolean {
  return SEPARATOR_RE.test(raw.trim());
}

export function isSectionLabel(raw: string): boolean {
  const token = raw.trim().toLowerCase().replace(/[:.\d]+$/g, "");
  return SECTION_WORDS.some((w) => token === w || token.startsWith(w));
}

export function isChordLine(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  let chordCount = 0;
  for (const w of words) {
    const isChord = isChordToken(w);
    const isSep = isSeparatorToken(w);
    const isSection = isSectionLabel(w);
    if (!isChord && !isSep && !isSection) return false;
    if (isChord) chordCount++;
  }
  return chordCount >= Math.ceil(words.length / 2) && chordCount > 0;
}

interface ParsedChord {
  root: string;
  accidental: string;
  quality: string;
  bass: string | null;
}

const CHORD_PARSE_RE =
  /^\(?([A-G])(#|b)?((?:maj|min|dim|aug|sus|add|m|M)?\d{0,2}\+?\d{0,2}(?:\((?:add)?\d+\))?)?(?:\/([A-G])(#|b)?)?\)?\.?$/;

export function parseChord(raw: string): ParsedChord | null {
  const token = normaliseAccidentals(raw.trim());
  const m = token.match(CHORD_PARSE_RE);
  if (!m) return null;
  return {
    root: m[1],
    accidental: m[2] || "",
    quality: m[3] || "",
    bass: m[4] ? m[4] + (m[5] || "") : null,
  };
}

function noteIndex(note: string): number | null {
  const idx = NOTE_TO_INDEX[note];
  return idx === undefined ? null : idx;
}

function spellNote(index: number, useFlats: boolean): string {
  const i = ((index % 12) + 12) % 12;
  return useFlats ? FLAT_NAMES[i] : SHARP_NAMES[i];
}

export function keyPrefersFlats(key: string): boolean {
  return FLAT_KEYS.has(key);
}

export function transposeChordText(raw: string, semitones: number, targetKey: string): string {
  const parsed = parseChord(raw);
  if (!parsed) return raw;
  const useFlats = keyPrefersFlats(targetKey);
  const rootIdx = noteIndex(parsed.root + parsed.accidental);
  if (rootIdx === null) return raw;
  const newRoot = spellNote(rootIdx + semitones, useFlats);

  let result = newRoot + (parsed.quality || "");
  if (parsed.bass) {
    const bassIdx = noteIndex(parsed.bass);
    if (bassIdx !== null) {
      result += "/" + spellNote(bassIdx + semitones, useFlats);
    } else {
      result += "/" + parsed.bass;
    }
  }

  // Preserve surrounding brackets/period if present in original token.
  if (/^\(.*\)\.?$/.test(raw.trim())) {
    result = raw.trim().endsWith(").") ? `(${result}).` : `(${result})`;
  } else if (raw.trim().endsWith(".")) {
    result += ".";
  }
  return result;
}

export function semitoneDistance(fromKey: string, toKey: string): number {
  const a = noteIndex(fromKey);
  const b = noteIndex(toKey);
  if (a === null || b === null) return 0;
  let diff = b - a;
  diff = ((diff + 6) % 12 + 12) % 12 - 6;
  // normalise to range [-6, 6) is unusual for UI; instead use [0,11] "up" distance typically.
  let up = b - a;
  up = ((up % 12) + 12) % 12;
  return up;
}

// Major key chord palettes (diatonic triads/7ths roots) used for scoring.
const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];

function diatonicRootsForMajor(tonicIdx: number): Set<number> {
  return new Set(MAJOR_SCALE_STEPS.map((s) => (tonicIdx + s) % 12));
}

export interface KeyGuessResult {
  key: string;
  isMinor: boolean;
}

export function guessKeyFromChords(chordTokens: string[]): KeyGuessResult {
  if (chordTokens.length === 0) return { key: "C", isMinor: false };

  const roots: number[] = [];
  for (const tok of chordTokens) {
    const parsed = parseChord(tok);
    if (!parsed) continue;
    const idx = noteIndex(parsed.root + parsed.accidental);
    if (idx !== null) roots.push(idx);
  }
  if (roots.length === 0) return { key: "C", isMinor: false };

  const first = roots[0];
  const last = roots[roots.length - 1];

  let bestScore = -Infinity;
  let bestTonic = 0;
  for (let tonic = 0; tonic < 12; tonic++) {
    const scale = diatonicRootsForMajor(tonic);
    let score = 0;
    for (const r of roots) {
      if (scale.has(r)) score += 1;
    }
    if (first === tonic) score += 2;
    if (last === tonic) score += 3;
    if (score > bestScore) {
      bestScore = score;
      bestTonic = tonic;
    }
  }

  const majorKey = SHARP_NAMES[bestTonic];
  // Switch to relative minor if the song ends on that minor chord (relative minor root = tonic - 3 semitones)
  const relativeMinorIdx = (bestTonic + 9) % 12;
  if (last === relativeMinorIdx) {
    const minorKeyName = spellNote(relativeMinorIdx, keyPrefersFlats(majorKey)) + "m";
    return { key: minorKeyName.replace("m", ""), isMinor: true };
  }

  return { key: majorKey, isMinor: false };
}

export function getKeyFromFileName(key: string | null): string | null {
  if (!key) return null;
  const cleaned = key.replace(/m$/i, "");
  const idx = noteIndex(cleaned);
  if (idx === null) return null;
  return spellNote(idx, keyPrefersFlats(cleaned));
}

export const ALL_KEYS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// Transpose a block of raw pasted text (chords-over-lyrics), preserving alignment.
export function transposeRawText(text: string, semitones: number, targetKey: string): string {
  const lines = text.split("\n");
  return lines
    .map((line) => {
      if (!isChordLine(line)) return line;
      // Replace each chord token in place, adjusting following spacing to keep alignment
      // when the new chord is a different length.
      let result = "";
      let i = 0;
      const re = /\S+/g;
      let match: RegExpExecArray | null;
      let lastIndex = 0;
      while ((match = re.exec(line)) !== null) {
        const token = match[0];
        result += line.slice(lastIndex, match.index);
        if (isChordToken(token)) {
          const newTok = transposeChordText(token, semitones, targetKey);
          result += newTok;
          const lenDiff = token.length - newTok.length;
          if (lenDiff > 0) {
            result += " ".repeat(lenDiff);
          }
        } else {
          result += token;
        }
        lastIndex = match.index + token.length;
        i++;
      }
      result += line.slice(lastIndex);
      return result;
    })
    .join("\n");
}
