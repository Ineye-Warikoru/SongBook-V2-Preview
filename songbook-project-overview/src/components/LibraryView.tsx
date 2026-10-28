"use client";
import { useMemo, useRef, useState } from "react";
import GlassButton from "./GlassButton";
import StatusIcon, { statusFor } from "./StatusIcon";
import type { LibrarySongDTO, SetlistEntryDTO, SongVersionDTO } from "@/lib/types";
import { normaliseSearch } from "@/lib/importParser";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

interface LibraryViewProps {
  library: LibrarySongDTO[];
  setlist: SetlistEntryDTO[];
  onImport: (text: string) => Promise<{ added: number; skipped: number; totalFound: number } | void>;
  onUploadFiles: (files: File[]) => Promise<void>;
  onOpenSaved: (initialTab: "inset" | "manage") => void;
  onVersionTap: (version: SongVersionDTO, songTitle: string) => void;
}

export default function LibraryView({ library, setlist, onImport, onUploadFiles, onOpenSaved, onVersionTap }: LibraryViewProps) {
  const [search, setSearch] = useState("");
  const [scoresOnly, setScoresOnly] = useState(false);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const scoresCount = useMemo(
    () => library.filter((s) => s.versions.some((v) => v.kind === "score")).length,
    [library],
  );

  const filtered = useMemo(() => {
    let songs = library;
    if (scoresOnly) {
      songs = songs
        .map((s) => ({ ...s, versions: s.versions.filter((v) => v.kind === "score") }))
        .filter((s) => s.versions.length > 0);
    }
    if (search.trim()) {
      const q = normaliseSearch(search);
      songs = songs.filter((s) => normaliseSearch(s.title).includes(q));
    }
    return songs;
  }, [library, scoresOnly, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, LibrarySongDTO[]>();
    for (const song of filtered) {
      const list = map.get(song.letter) ?? [];
      list.push(song);
      map.set(song.letter, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.title.localeCompare(b.title));
    return map;
  }, [filtered]);

  const availableLetters = new Set(grouped.keys());

  function jumpToLetter(letter: string) {
    setActiveLetter(letter);
    const el = sectionRefs.current.get(letter);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleImport() {
    if (!importText.trim()) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const result = await onImport(importText);
      if (result) {
        setImportStatus(`Added ${result.added} new version${result.added === 1 ? "" : "s"} (${result.skipped} already known, ${result.totalFound} .pdf names found).`);
      }
      setImportText("");
    } catch (err) {
      setImportStatus(err instanceof Error ? err.message : "Could not import that list.");
    } finally {
      setImporting(false);
    }
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) await onUploadFiles(files);
    e.target.value = "";
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <input ref={fileInputRef} type="file" accept="application/pdf" multiple hidden onChange={handleFiles} />
        <GlassButton onClick={() => fileInputRef.current?.click()}>Add PDFs from Files</GlassButton>
        <GlassButton onClick={() => onOpenSaved("inset")}>Setlist ({setlist.length})</GlassButton>
        <GlassButton onClick={() => onOpenSaved("manage")}>
          Saved PDFs ({library.reduce((n, s) => n + s.versions.filter((v) => v.status === "added").length, 0)})
        </GlassButton>
      </div>

      <div className="song-card" style={{ marginBottom: 16, cursor: "pointer" }} onClick={() => setImportOpen((v) => !v)}>
        <p style={{ margin: 0, fontWeight: 600 }}>{importOpen ? "▼" : "▶"} Import song list</p>
        {importOpen && (
          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 0 }}>
              Open kasg.co.uk/music, select all, copy, then paste it below.
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={5}
              style={{ width: "100%", resize: "vertical" }}
              placeholder="Paste the page content here…"
            />
            <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
              <GlassButton variant="primary" disabled={importing} onClick={handleImport}>
                {importing ? "Importing…" : "Import"}
              </GlassButton>
              {importStatus && <span style={{ fontSize: 13, color: "var(--text-2)" }}>{importStatus}</span>}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="search"
          placeholder="Search all songs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <GlassButton variant={scoresOnly ? "primary" : "default"} onClick={() => setScoresOnly((v) => !v)}>
          Scores only ({scoresCount})
        </GlassButton>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {LETTERS.map((l) => (
          <button
            key={l}
            className={`letter-btn ${activeLetter === l ? "active" : ""}`}
            disabled={!availableLetters.has(l)}
            onClick={() => jumpToLetter(l)}
          >
            {l}
          </button>
        ))}
      </div>

      {library.length === 0 && (
        <p style={{ color: "var(--text-2)", textAlign: "center", padding: "40px 0" }}>
          Your library is empty. Open “Import song list” above to get started.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {LETTERS.filter((l) => grouped.has(l)).map((letter) => (
          <div
            key={letter}
            ref={(el) => {
              if (el) sectionRefs.current.set(letter, el);
            }}
          >
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>{letter}</h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {grouped.get(letter)!.map((song) => (
                <div key={song.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--border-soft)" }}>
                  <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 16 }}>{song.title}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {song.versions.map((v) => {
                      const inSetlist = !!v.setlistPosition;
                      const status = statusFor(v.status, inSetlist);
                      return (
                        <button
                          key={v.id}
                          className={`chip state-${status.replace("_", "-")}`}
                          onClick={() => onVersionTap(v, song.title)}
                        >
                          <StatusIcon status={status} /> {v.kind === "score" ? "Score" : v.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
