"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingScreen from "./LoadingScreen";
import Header from "./Header";
import PillSwitch from "./PillSwitch";
import GlassButton from "./GlassButton";
import LibraryView from "./LibraryView";
import TransposeView from "./TransposeView";
import SettingsDrawer from "./SettingsDrawer";
import SetlistDrawer from "./SetlistDrawer";
import { api } from "@/lib/api";
import { applyThemeToDocument } from "@/lib/applyTheme";
import type { AppSettingsData, LibrarySongDTO, SetlistEntryDTO, SongVersionDTO } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

type Tab = "library" | "transpose";

function openFilePicker(multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.multiple = multiple;
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      document.body.removeChild(input);
      resolve(files);
    });
    input.addEventListener("cancel", () => {
      document.body.removeChild(input);
      resolve([]);
    });
    input.click();
  });
}

export default function SongbookApp() {
  const [settings, setSettings] = useState<AppSettingsData>(DEFAULT_SETTINGS);
  const [systemDark, setSystemDark] = useState(false);
  const [library, setLibrary] = useState<LibrarySongDTO[]>([]);
  const [setlist, setSetlist] = useState<SetlistEntryDTO[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("library");
  const [current, setCurrent] = useState<{ version: SongVersionDTO; songTitle: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scrollToAi, setScrollToAi] = useState(false);
  const [setlistDrawer, setSetlistDrawer] = useState<{ tab: "inset" | "manage" } | null>(null);

  const resolvedMode: "light" | "dark" = settings.mode === "auto" ? (systemDark ? "dark" : "light") : settings.mode;

  const refreshLibrary = useCallback(async () => {
    const { songs } = await api.getLibrary();
    setLibrary(songs);
    return songs;
  }, []);

  const refreshSetlist = useCallback(async () => {
    const { entries } = await api.getSetlist();
    setSetlist(entries);
    return entries;
  }, []);

  useEffect(() => {
    api.getSettings().then((r) => setSettings(r.settings)).catch(() => {});
    refreshLibrary().catch(() => {});
    refreshSetlist().catch(() => {});

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [refreshLibrary, refreshSetlist]);

  useEffect(() => {
    applyThemeToDocument(resolvedMode, settings.theme, settings.customColor);
  }, [resolvedMode, settings.theme, settings.customColor]);

  // Keep `current` in sync with fresh library/setlist data.
  useEffect(() => {
    if (!current) return;
    for (const song of library) {
      const v = song.versions.find((ver) => ver.id === current.version.id);
      if (v) {
        setCurrent({ version: v, songTitle: song.title });
        return;
      }
    }
  }, [library]); // eslint-disable-line react-hooks/exhaustive-deps

  function persistSettings(patch: Partial<AppSettingsData>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch } as AppSettingsData;
      api.updateSettings(patch).catch(() => {});
      return next;
    });
  }

  function toggleMode() {
    const next = resolvedMode === "dark" ? "light" : "dark";
    persistSettings({ mode: next });
  }

  async function handleImport(text: string) {
    const result = await api.importSongs(text);
    await refreshLibrary();
    return result;
  }

  async function handleUploadFiles(files: File[]) {
    await api.uploadPdfs(files);
    await Promise.all([refreshLibrary(), refreshSetlist()]);
  }

  function findVersion(versionId: number): { version: SongVersionDTO; songTitle: string } | null {
    for (const song of library) {
      const v = song.versions.find((ver) => ver.id === versionId);
      if (v) return { version: v, songTitle: song.title };
    }
    return null;
  }

  async function handleVersionTap(version: SongVersionDTO, songTitle: string) {
    if (version.status === "not_downloaded") {
      const url = `https://kasg.co.uk/music/${encodeURIComponent(version.fileName)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      await api.markDownloaded(version.id);
      await refreshLibrary();
      return;
    }
    if (version.status === "downloaded") {
      const files = await openFilePicker(false);
      if (files.length > 0) {
        await api.uploadPdfs(files);
        await Promise.all([refreshLibrary(), refreshSetlist()]);
      }
      return;
    }
    if (version.status === "added" && !version.setlistPosition) {
      await api.addToSetlist(version.id);
      await Promise.all([refreshLibrary(), refreshSetlist()]);
      return;
    }
    setCurrent({ version, songTitle });
    setActiveTab("transpose");
  }

  async function handleAddToAppFromDrawer() {
    const files = await openFilePicker(false);
    if (files.length > 0) {
      await api.uploadPdfs(files);
      await Promise.all([refreshLibrary(), refreshSetlist()]);
    }
  }

  const currentEntry = useMemo(
    () => (current ? setlist.find((e) => e.versionId === current.version.id) ?? null : null),
    [current, setlist],
  );

  const tabOptions = useMemo(
    () => [
      { id: "library", label: "Library" },
      { id: "transpose", label: "Transpose" },
    ],
    [],
  );

  const songTabOptions = useMemo(
    () => setlist.map((e, idx) => ({ id: String(e.versionId), label: `${idx + 1}. ${e.songTitle}` })),
    [setlist],
  );

  return (
    <div className="app-shell">
      <LoadingScreen />
      <div className="app-bg" />
      <div className="app-container">
        <Header
          resolvedMode={resolvedMode}
          onToggleMode={toggleMode}
          onOpenSettings={() => {
            setScrollToAi(false);
            setSettingsOpen(true);
          }}
          helpText="Save the PDF to your device from the Library (Share, then Save to Files), then choose it here. Songbook reads the page and changes only the chord names. Everything else stays exactly as it is."
        />

        <PillSwitch
          options={tabOptions}
          value={activeTab}
          onChange={(v) => setActiveTab(v as Tab)}
          className="mb-5"
        />

        {setlist.length > 0 && (
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <PillSwitch
              options={songTabOptions}
              value={current ? String(current.version.id) : ""}
              onChange={(v) => {
                const found = findVersion(Number(v));
                if (found) {
                  setCurrent(found);
                  setActiveTab("transpose");
                }
              }}
            />
            {activeTab === "library" && (
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <GlassButton onClick={() => setSetlistDrawer({ tab: "inset" })}>Setlist ≡</GlassButton>
                <GlassButton
                  onClick={async () => {
                    await api.clearSetlist();
                    setCurrent(null);
                    await Promise.all([refreshLibrary(), refreshSetlist()]);
                  }}
                >
                  Clear set
                </GlassButton>
              </div>
            )}
          </div>
        )}

        <main style={{ marginTop: 10 }}>
          {activeTab === "library" ? (
            <LibraryView
              library={library}
              setlist={setlist}
              onImport={handleImport}
              onUploadFiles={handleUploadFiles}
              onOpenSaved={(tab) => setSetlistDrawer({ tab })}
              onVersionTap={handleVersionTap}
            />
          ) : current ? (
            <TransposeView
              key={current.version.id}
              version={current.version}
              songTitle={current.songTitle}
              setlistEntry={currentEntry}
              setlist={setlist}
              settings={settings}
              onMoveSetlist={async (direction) => {
                if (!currentEntry) return;
                await api.moveSetlist(currentEntry.id, direction);
                await refreshSetlist();
              }}
              onRemoveFromSetlist={async () => {
                if (!currentEntry) return;
                await api.removeFromSetlist(currentEntry.id);
                await Promise.all([refreshSetlist(), refreshLibrary()]);
              }}
              onOpenSetlist={() => setSetlistDrawer({ tab: "inset" })}
              onClearSetlist={async () => {
                await api.clearSetlist();
                setCurrent(null);
                await Promise.all([refreshLibrary(), refreshSetlist()]);
              }}
              onSetKeyOverride={async (key) => {
                if (!currentEntry) return;
                await api.setSetlistKey(currentEntry.id, key);
                await refreshSetlist();
              }}
              onSwitchVersion={(versionId) => {
                const found = findVersion(versionId);
                if (found) setCurrent(found);
              }}
              onCloseDisplay={() => setCurrent(null)}
              onNeedApiKey={() => {
                setScrollToAi(true);
                setSettingsOpen(true);
              }}
              onBarPositionChange={(x, y) => persistSettings({ bar: { ...settings.bar, x, y, position: "custom" } })}
            />
          ) : (
            <p style={{ color: "var(--text-2)", textAlign: "center", padding: "60px 0" }}>
              Open a song from your Library to start transposing.
            </p>
          )}
        </main>
      </div>

      <p className="app-credit">By Ineye Brian Warikoru</p>

      {settingsOpen && (
        <SettingsDrawer
          settings={settings}
          onUpdate={persistSettings}
          onResetSettings={async () => {
            const r = await api.resetSettings();
            setSettings(r.settings);
          }}
          onClose={() => setSettingsOpen(false)}
          scrollToAi={scrollToAi}
        />
      )}

      {setlistDrawer && (
        <SetlistDrawer
          initialTab={setlistDrawer.tab}
          library={library}
          setlist={setlist}
          onClose={() => setSetlistDrawer(null)}
          onAddToApp={handleAddToAppFromDrawer}
          onReset={async (versionId) => {
            await api.resetVersion(versionId);
            await Promise.all([refreshLibrary(), refreshSetlist()]);
          }}
          onDelete={async (versionId) => {
            if (current?.version.id === versionId) setCurrent(null);
            await api.deleteVersion(versionId);
            await Promise.all([refreshLibrary(), refreshSetlist()]);
          }}
          onDeleteAll={async () => {
            setCurrent(null);
            await api.deleteAllPdfs();
            await Promise.all([refreshLibrary(), refreshSetlist()]);
          }}
          onOpenVersion={(versionId) => {
            const found = findVersion(versionId);
            if (found) {
              setCurrent(found);
              setActiveTab("transpose");
              setSetlistDrawer(null);
            }
          }}
          onAddToSetlist={async (versionId) => {
            await api.addToSetlist(versionId);
            await Promise.all([refreshSetlist(), refreshLibrary()]);
          }}
          onRemoveFromSetlist={async (entryId) => {
            await api.removeFromSetlist(entryId);
            await Promise.all([refreshSetlist(), refreshLibrary()]);
          }}
          onClearSetlist={async () => {
            await api.clearSetlist();
            setCurrent(null);
            await Promise.all([refreshLibrary(), refreshSetlist()]);
          }}
        />
      )}
    </div>
  );
}
