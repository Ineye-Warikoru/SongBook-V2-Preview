"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import GlassButton from "./GlassButton";
import TwoTapButton from "./TwoTapButton";
import FloatingBar from "./FloatingBar";
import { api } from "@/lib/api";
import {
  ALL_KEYS,
  getKeyFromFileName,
  guessKeyFromChords,
  semitoneDistance,
  transposeRawText,
} from "@/lib/chordEngine";
import {
  collectChordTokens,
  extractLines,
  loadPdfDocument,
  paintTransposedChords,
  type LineInfo,
} from "@/lib/pdfEngine";
import type { AppSettingsData, SetlistEntryDTO, SongVersionDTO } from "@/lib/types";

interface TransposeViewProps {
  version: SongVersionDTO;
  songTitle: string;
  setlistEntry: SetlistEntryDTO | null;
  setlist: SetlistEntryDTO[];
  settings: AppSettingsData;
  onMoveSetlist: (direction: "left" | "right") => void;
  onRemoveFromSetlist: () => void;
  onOpenSetlist: () => void;
  onClearSetlist: () => void;
  onSetKeyOverride: (key: string) => void;
  onSwitchVersion: (versionId: number) => void;
  onCloseDisplay: () => void;
  onNeedApiKey: () => void;
  onBarPositionChange: (x: number, y: number) => void;
}

interface PageRender {
  canvas: HTMLCanvasElement;
  original: HTMLCanvasElement;
  lines: LineInfo[];
}

export default function TransposeView(props: TransposeViewProps) {
  const { version, songTitle, setlistEntry, setlist, settings } = props;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pages, setPages] = useState<PageRender[]>([]);
  const [originalKey, setOriginalKey] = useState<string>("C");
  const [targetKey, setTargetKey] = useState<string>(setlistEntry?.keyOverride || version.key || "C");
  const [viewMode, setViewMode] = useState<"pdf" | "transcription">("pdf");
  const [transcriptionText, setTranscriptionText] = useState<string>(version.transcriptionType ? "" : "");
  const [transcriptionType, setTranscriptionType] = useState<"staff" | "chords" | null>(version.transcriptionType);
  const [transcribing, setTranscribing] = useState<"staff" | "chords" | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [showRawImport, setShowRawImport] = useState(false);
  const [rawText, setRawText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abcContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const semitones = semitoneDistance(originalKey, targetKey);

  // Load PDF + extract chord data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      setPages([]);
      try {
        const { data } = await api.getPdf(version.id);
        const doc = await loadPdfDocument(data);
        const rendered: PageRender[] = [];
        const allChordTokens: string[] = [];
        const scale = 1.6;
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;

          const original = document.createElement("canvas");
          original.width = canvas.width;
          original.height = canvas.height;
          original.getContext("2d")?.drawImage(canvas, 0, 0);

          const lines = await extractLines(page, viewport);
          allChordTokens.push(...collectChordTokens(lines));
          rendered.push({ canvas, original, lines });
        }
        if (cancelled) return;
        setPages(rendered);

        const fileKey = getKeyFromFileName(version.key);
        let startKey = fileKey;
        if (!startKey) {
          const guess = guessKeyFromChords(allChordTokens);
          startKey = guess.key;
        }
        setOriginalKey(startKey || "C");
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError("Couldn't read that PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [version.id, version.key]);

  useEffect(() => {
    if (setlistEntry?.keyOverride) setTargetKey(setlistEntry.keyOverride);
  }, [setlistEntry?.keyOverride]);

  useEffect(() => {
    setTranscriptionType(version.transcriptionType);
    setViewMode(version.transcriptionType && !version.hasTranscription ? "pdf" : "pdf");
  }, [version.id, version.transcriptionType]);

  // Load saved transcription text lazily
  useEffect(() => {
    let cancelled = false;
    async function loadTranscription() {
      if (!version.hasTranscription) {
        setTranscriptionText("");
        return;
      }
      try {
        const full = await api.getVersion(version.id);
        if (!cancelled) {
          setTranscriptionText(full.transcriptionText || "");
          setTranscriptionType(full.transcriptionType);
        }
      } catch {
        // ignore
      }
    }
    loadTranscription();
    return () => {
      cancelled = true;
    };
  }, [version.id, version.hasTranscription]);

  // Repaint canvases whenever key/semitones change
  useEffect(() => {
    for (const p of pages) {
      const ctx = p.canvas.getContext("2d");
      const origCtx = p.original.getContext("2d");
      if (!ctx || !origCtx) continue;
      ctx.drawImage(p.original, 0, 0);
      if (semitones !== 0) {
        paintTransposedChords(ctx, origCtx, p.lines, semitones, targetKey);
      }
    }
    // Trigger a redraw by forcing state (canvas mutated in place; attach via ref in render)
    setPages((prev) => [...prev]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semitones, targetKey, pages.length]);

  function handleKeySelect(key: string) {
    setTargetKey(key);
    if (setlistEntry) props.onSetKeyOverride(key);
  }

  function handleSemitone(delta: number) {
    const idx = ALL_KEYS.indexOf(targetKey);
    if (idx === -1) return;
    const next = ALL_KEYS[((idx + delta) % 12 + 12) % 12];
    handleKeySelect(next);
  }

  async function runTranscription(mode: "staff" | "chords") {
    const providerId = settings.aiProvider;
    const cfg = settings.aiProviders[providerId];
    if (!cfg?.apiKey) {
      props.onNeedApiKey();
      return;
    }
    if (pages.length === 0) return;
    setTranscribing(mode);
    setTranscribeError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const images = pages.slice(0, 4).map((p) => p.original.toDataURL("image/jpeg", 0.82).split(",")[1]);
      const result = await api.transcribe({
        provider: providerId,
        apiKey: cfg.apiKey,
        model: cfg.model,
        baseUrl: cfg.baseUrl,
        mode,
        images,
      });
      setTranscriptionText(result.text);
      setTranscriptionType(mode);
      setViewMode("transcription");
      await api.saveTranscription(version.id, mode, result.text);
      if (result.warning) setTranscribeError(result.warning);
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setTranscribing(null);
      abortRef.current = null;
    }
  }

  function stopTranscription() {
    abortRef.current?.abort();
    setTranscribing(null);
  }

  // abcjs rendering
  useEffect(() => {
    if (viewMode !== "transcription" || transcriptionType !== "staff" || !transcriptionText) return;
    let cancelled = false;
    import("abcjs")
      .then((abcjsModule) => {
        if (cancelled || !abcContainerRef.current) return;
        const abcjs = abcjsModule.default || abcjsModule;
        try {
          abcjs.renderAbc(abcContainerRef.current, transcriptionText, {
            visualTranspose: semitones,
            responsive: "resize",
          });
        } catch (err) {
          console.error("abcjs render failed", err);
        }
      })
      .catch(() => {
        // library failed to load; raw text fallback is rendered separately
      });
    return () => {
      cancelled = true;
    };
  }, [viewMode, transcriptionType, transcriptionText, semitones]);

  const currentIndex = setlist.findIndex((e) => e.versionId === version.id);
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex >= 0 && currentIndex < setlist.length - 1;

  function goSongs(direction: 1 | -1) {
    if (setlist.length < 2) return;
    let idx = currentIndex;
    if (idx === -1) idx = 0;
    let next = idx + direction;
    if (next < 0) next = settings.bar.wrap ? setlist.length - 1 : 0;
    if (next >= setlist.length) next = settings.bar.wrap ? 0 : setlist.length - 1;
    if (next !== idx) props.onSwitchVersion(setlist[next].versionId);
    if (settings.bar.scrollToTop) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goPages(direction: 1 | -1) {
    const target = currentPage - 1 + direction;
    let clamped = target;
    if (clamped < 0) clamped = settings.bar.wrap ? pages.length - 1 : 0;
    if (clamped >= pages.length) clamped = settings.bar.wrap ? 0 : pages.length - 1;
    setCurrentPage(clamped + 1);
    const el = pageRefs.current.get(clamped + 1);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const barMode = settings.bar.mode;
  const showBar =
    settings.bar.enabled &&
    viewMode === "pdf" &&
    ((barMode === "songs" && setlist.length >= 2 && currentIndex !== -1) ||
      (barMode === "pages" && pages.length >= 2));

  const barLabel =
    barMode === "songs"
      ? `${currentIndex + 1} / ${setlist.length} · ${originalKey} → ${targetKey}`
      : `${currentPage} / ${pages.length}`;

  return (
    <div>
      <div className="song-card" style={{ marginBottom: 18, display: "flex", flexWrap: "wrap", gap: 8 }}>
        <GlassButton onClick={() => goSongs(-1)} disabled={setlist.length < 2}>‹ Prev</GlassButton>
        <GlassButton onClick={() => goSongs(1)} disabled={setlist.length < 2}>Next ›</GlassButton>
        <GlassButton onClick={() => props.onMoveSetlist("left")} disabled={!canMoveLeft}>◀ Move left</GlassButton>
        <GlassButton onClick={() => props.onMoveSetlist("right")} disabled={!canMoveRight}>Move right ▶</GlassButton>
        <GlassButton onClick={props.onRemoveFromSetlist} disabled={currentIndex === -1}>Remove</GlassButton>
        <GlassButton onClick={props.onOpenSetlist}>Setlist ≡</GlassButton>
        <GlassButton onClick={props.onClearSetlist}>Clear set</GlassButton>
        <GlassButton onClick={props.onCloseDisplay}>Remove display</GlassButton>
        <GlassButton onClick={() => runTranscription("staff")} disabled={transcribing !== null || pages.length === 0}>
          {transcribing === "staff" ? "Transcribing…" : "Transcribe staff"}
        </GlassButton>
        <GlassButton onClick={() => runTranscription("chords")} disabled={transcribing !== null || pages.length === 0}>
          {transcribing === "chords" ? "Transcribing…" : "Transcribe chords"}
        </GlassButton>
        <GlassButton onClick={() => setShowRawImport((v) => !v)}>Import raw text</GlassButton>
        {transcribing && <GlassButton variant="danger" onClick={stopTranscription}>Stop</GlassButton>}
        {transcriptionText && (
          <GlassButton onClick={() => setViewMode(viewMode === "pdf" ? "transcription" : "pdf")}>
            {viewMode === "pdf" ? "Show transcription" : "Show PDF"}
          </GlassButton>
        )}
      </div>

      {transcribeError && (
        <p style={{ color: "#ef4444", fontSize: 13.5, marginBottom: 12 }}>{transcribeError}</p>
      )}

      {showRawImport && (
        <div className="song-card" style={{ marginBottom: 18 }}>
          <p style={{ fontWeight: 600, marginTop: 0 }}>Paste chords-over-lyrics text</p>
          <textarea rows={6} style={{ width: "100%" }} value={rawText} onChange={(e) => setRawText(e.target.value)} />
          {rawText.trim() && (
            <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", fontSize: 13.5 }}>
              {transposeRawText(rawText, semitones, targetKey)}
            </pre>
          )}
        </div>
      )}

      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>
        {songTitle} ({originalKey})
      </h2>
      <p style={{ fontWeight: 700, margin: "0 0 10px" }}>
        Key {originalKey} → {targetKey} ({semitones} semitone{Math.abs(semitones) === 1 ? "" : "s"} up)
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ color: "var(--text-2)", fontSize: 14 }}>Original key</span>
        <select value={originalKey} onChange={(e) => setOriginalKey(e.target.value)}>
          {ALL_KEYS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <span style={{ color: "var(--text-2)", fontSize: 13 }}>
          {getKeyFromFileName(version.key) ? "(from the file name)" : "(guessed)"}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        {ALL_KEYS.map((k) => (
          <button
            key={k}
            className="glass-btn key-btn"
            style={
              targetKey === k
                ? { background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))", color: "#fff" }
                : undefined
            }
            onClick={() => handleKeySelect(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <GlassButton onClick={() => handleSemitone(-1)}>− semitone</GlassButton>
        <GlassButton onClick={() => handleSemitone(1)}>+ semitone</GlassButton>
      </div>

      <div ref={containerRef} style={{ position: "relative" }}>
        {viewMode === "pdf" ? (
          <>
            {loading && <p style={{ color: "var(--text-2)" }}>Loading the PDF…</p>}
            {loadError && <p style={{ color: "#ef4444" }}>{loadError}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {pages.map((p, idx) => (
                <div
                  key={idx}
                  ref={(el) => {
                    if (el) pageRefs.current.set(idx + 1, el);
                  }}
                  style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.18)" }}
                >
                  <CanvasHost canvas={p.canvas} />
                </div>
              ))}
            </div>
          </>
        ) : transcriptionType === "staff" ? (
          <div>
            <div ref={abcContainerRef} className="song-card" style={{ background: "#fff", color: "#111" }} />
            <p style={{ fontWeight: 600, margin: "16px 0 8px" }}>Edit the transcription</p>
            <textarea
              rows={10}
              style={{ width: "100%", fontFamily: "ui-monospace, monospace" }}
              value={transcriptionText}
              onChange={(e) => setTranscriptionText(e.target.value)}
              onBlur={() => api.saveTranscription(version.id, "staff", transcriptionText)}
            />
          </div>
        ) : (
          <div>
            <pre className="song-card" style={{ whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", fontSize: 13.5 }}>
              {transposeRawText(transcriptionText, semitones, targetKey)}
            </pre>
            <p style={{ fontWeight: 600, margin: "16px 0 8px" }}>Edit the transcription</p>
            <textarea
              rows={10}
              style={{ width: "100%", fontFamily: "ui-monospace, monospace" }}
              value={transcriptionText}
              onChange={(e) => setTranscriptionText(e.target.value)}
              onBlur={() => api.saveTranscription(version.id, "chords", transcriptionText)}
            />
          </div>
        )}
      </div>

      {showBar && (
        <FloatingBar
          settings={settings.bar}
          label={barLabel}
          canPrev={settings.bar.wrap || (barMode === "songs" ? currentIndex > 0 : currentPage > 1)}
          canNext={settings.bar.wrap || (barMode === "songs" ? currentIndex < setlist.length - 1 : currentPage < pages.length)}
          onPrev={() => (barMode === "songs" ? goSongs(-1) : goPages(-1))}
          onNext={() => (barMode === "songs" ? goSongs(1) : goPages(1))}
          onPositionChange={props.onBarPositionChange}
        />
      )}
    </div>
  );
}

function CanvasHost({ canvas }: { canvas: HTMLCanvasElement }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.display = "block";
    host.appendChild(canvas);
  }, [canvas]);
  return <div ref={hostRef} />;
}
