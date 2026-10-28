"use client";
import { useMemo, useState } from "react";
import Drawer from "./Drawer";
import PillSwitch from "./PillSwitch";
import GlassButton from "./GlassButton";
import TwoTapButton from "./TwoTapButton";
import StatusIcon from "./StatusIcon";
import type { LibrarySongDTO, SetlistEntryDTO, SongVersionDTO } from "@/lib/types";
import { normaliseSearch } from "@/lib/importParser";

interface SetlistDrawerProps {
  initialTab: "inset" | "manage";
  library: LibrarySongDTO[];
  setlist: SetlistEntryDTO[];
  onClose: () => void;
  onAddToApp: (versionId: number) => void;
  onReset: (versionId: number) => void;
  onDelete: (versionId: number) => void;
  onDeleteAll: () => void;
  onOpenVersion: (versionId: number) => void;
  onAddToSetlist: (versionId: number) => void;
  onRemoveFromSetlist: (entryId: number) => void;
  onClearSetlist: () => void;
}

interface FlatVersion {
  version: SongVersionDTO;
  title: string;
}

export default function SetlistDrawer(props: SetlistDrawerProps) {
  const [tab, setTab] = useState<"inset" | "manage">(props.initialTab);
  const [search, setSearch] = useState("");

  const flatVersions: FlatVersion[] = useMemo(() => {
    const list: FlatVersion[] = [];
    for (const song of props.library) {
      for (const v of song.versions) {
        if (v.status !== "not_downloaded") list.push({ version: v, title: song.title });
      }
    }
    return list;
  }, [props.library]);

  const filtered = useMemo(() => {
    if (!search.trim()) return flatVersions;
    const q = normaliseSearch(search);
    return flatVersions.filter((f) => normaliseSearch(f.title).includes(q));
  }, [flatVersions, search]);

  const pending = filtered.filter((f) => f.version.status === "downloaded");
  const added = filtered.filter((f) => f.version.status === "added");

  const totalStored = flatVersions.filter((f) => f.version.status === "added").length;

  return (
    <Drawer title={tab === "inset" ? "Setlist" : "Manage PDFs"} onClose={props.onClose}>
      <PillSwitch
        options={[
          { id: "inset", label: `In set (${props.setlist.length})` },
          { id: "manage", label: `Manage PDFs (${totalStored})` },
        ]}
        value={tab}
        onChange={(v) => setTab(v as "inset" | "manage")}
        className="mb-5"
      />

      {tab === "inset" ? (
        <div style={{ marginTop: 18 }}>
          <p style={{ fontWeight: 700, marginBottom: 12 }}>In your setlist</p>
          {props.setlist.length === 0 && (
            <p style={{ color: "var(--text-2)", fontSize: 14 }}>Nothing in your setlist yet. Add songs from the Library.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {props.setlist.map((entry, idx) => (
              <div key={entry.id} className="song-card">
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>
                  {idx + 1}. {entry.songTitle}{" "}
                  <span style={{ fontWeight: 400, color: "var(--text-2)", fontSize: 13.5 }}>
                    Key {entry.originalKey || "?"} → {entry.keyOverride || entry.originalKey || "?"}
                  </span>
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <GlassButton small onClick={() => props.onOpenVersion(entry.versionId)}>Open</GlassButton>
                  <GlassButton small onClick={() => props.onRemoveFromSetlist(entry.id)}>Remove</GlassButton>
                </div>
              </div>
            ))}
          </div>
          {props.setlist.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <GlassButton onClick={props.onClearSetlist}>Clear set</GlassButton>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <StatusIcon status="not_downloaded" />
              <span style={{ fontSize: 13.5, color: "var(--text-1)" }}>
                Not downloaded: tap its blue button in the Library to open the PDF
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <StatusIcon status="downloaded" />
              <span style={{ fontSize: 13.5, color: "var(--text-1)" }}>Downloaded, waiting to be added to the app</span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <StatusIcon status="added" />
              <span style={{ fontSize: 13.5, color: "var(--text-1)" }}>Added to the app</span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <StatusIcon status="in_setlist" />
              <span style={{ fontSize: 13.5, color: "var(--text-1)" }}>In the setlist</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <input
              type="search"
              placeholder="Search my PDFs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <TwoTapButton
              label=""
              armedLabel="Confirm delete all"
              onConfirm={props.onDeleteAll}
              className="danger-icon"
              title="Delete all stored PDFs"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </TwoTapButton>
          </div>

          {pending.length > 0 && (
            <>
              <p style={{ textTransform: "uppercase", fontSize: 12, letterSpacing: "0.06em", color: "var(--text-2)", marginBottom: 10 }}>
                Downloaded, pending to add ({pending.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
                {pending.map((f) => (
                  <div key={f.version.id} className="song-card">
                    <p style={{ margin: 0, fontWeight: 700 }}>
                      {f.title} <span style={{ fontWeight: 400, color: "var(--text-2)", fontSize: 13.5 }}>Key {f.version.key || "?"}</span>
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      <span className="chip state-downloaded">
                        <StatusIcon status="downloaded" /> Pending
                      </span>
                      <GlassButton small onClick={() => props.onAddToApp(f.version.id)}>Add to app</GlassButton>
                      <GlassButton small onClick={() => props.onReset(f.version.id)}>Reset</GlassButton>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <p style={{ textTransform: "uppercase", fontSize: 12, letterSpacing: "0.06em", color: "var(--text-2)", marginBottom: 10 }}>
            In the app ({added.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {added.map((f) => (
              <div key={f.version.id} className="song-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>
                    {f.title} <span style={{ fontWeight: 400, color: "var(--text-2)", fontSize: 13.5 }}>{f.version.label}</span>
                  </p>
                  <span className={`chip ${f.version.setlistPosition ? "state-in-setlist" : "state-added"}`}>
                    <StatusIcon status={f.version.setlistPosition ? "in_setlist" : "added"} />
                    {f.version.setlistPosition ? `In setlist #${f.version.setlistPosition}` : "Added"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <GlassButton small onClick={() => props.onOpenVersion(f.version.id)}>Open</GlassButton>
                  {!f.version.setlistPosition && (
                    <GlassButton small onClick={() => props.onAddToSetlist(f.version.id)}>Add to set</GlassButton>
                  )}
                  <TwoTapButton label="Delete" armedLabel="Confirm?" onConfirm={() => props.onDelete(f.version.id)} />
                </div>
              </div>
            ))}
            {added.length === 0 && <p style={{ color: "var(--text-2)", fontSize: 14 }}>No stored PDFs yet.</p>}
          </div>
        </div>
      )}
    </Drawer>
  );
}
