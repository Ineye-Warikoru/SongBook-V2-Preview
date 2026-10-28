import type { AppSettingsData, LibrarySongDTO, SetlistEntryDTO } from "./types";

async function asJson<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string })?.error || "Request failed");
  }
  return json as T;
}

export const api = {
  getLibrary: () => fetch("/api/songs").then((r) => asJson<{ songs: LibrarySongDTO[] }>(r)),
  importSongs: (text: string) =>
    fetch("/api/songs/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }).then((r) => asJson<{ ok: boolean; added: number; skipped: number; totalFound: number }>(r)),

  markDownloaded: (versionId: number) =>
    fetch(`/api/versions/${versionId}/mark-downloaded`, { method: "POST" }).then((r) => asJson(r)),
  resetVersion: (versionId: number) =>
    fetch(`/api/versions/${versionId}/reset`, { method: "POST" }).then((r) => asJson(r)),
  deleteVersion: (versionId: number) =>
    fetch(`/api/versions/${versionId}`, { method: "DELETE" }).then((r) => asJson(r)),
  deleteAllPdfs: () => fetch("/api/versions/upload", { method: "DELETE" }).then((r) => asJson(r)),
  uploadPdfs: (files: File[]) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    return fetch("/api/versions/upload", { method: "POST", body: form }).then((r) =>
      asJson<{ ok: boolean; count: number }>(r),
    );
  },
  getPdf: (versionId: number) =>
    fetch(`/api/versions/${versionId}/pdf`).then((r) => asJson<{ data: string; mime: string }>(r)),
  saveTranscription: (versionId: number, type: "staff" | "chords", text: string) =>
    fetch(`/api/versions/${versionId}/transcription`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, text }),
    }).then((r) => asJson(r)),
  getVersion: (versionId: number) =>
    fetch(`/api/versions/${versionId}`).then((r) =>
      asJson<{
        id: number;
        title: string;
        label: string;
        key: string | null;
        capo: number | null;
        kind: string;
        status: string;
        hasPdf: boolean;
        transcriptionType: "staff" | "chords" | null;
        transcriptionText: string | null;
      }>(r),
    ),

  getSetlist: () => fetch("/api/setlist").then((r) => asJson<{ entries: SetlistEntryDTO[] }>(r)),
  addToSetlist: (versionId: number) =>
    fetch("/api/setlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ versionId }),
    }).then((r) => asJson(r)),
  removeFromSetlist: (entryId: number) =>
    fetch(`/api/setlist/${entryId}`, { method: "DELETE" }).then((r) => asJson(r)),
  clearSetlist: () => fetch("/api/setlist", { method: "DELETE" }).then((r) => asJson(r)),
  moveSetlist: (entryId: number, move: "left" | "right") =>
    fetch(`/api/setlist/${entryId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ move }),
    }).then((r) => asJson(r)),
  setSetlistKey: (entryId: number, keyOverride: string) =>
    fetch(`/api/setlist/${entryId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keyOverride }),
    }).then((r) => asJson(r)),

  getSettings: () => fetch("/api/settings").then((r) => asJson<{ settings: AppSettingsData }>(r)),
  updateSettings: (patch: Partial<AppSettingsData>) =>
    fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => asJson<{ ok: boolean; settings: AppSettingsData }>(r)),
  resetSettings: () => fetch("/api/settings", { method: "DELETE" }).then((r) => asJson<{ settings: AppSettingsData }>(r)),

  transcribe: (payload: {
    provider: string;
    apiKey: string;
    model?: string;
    baseUrl?: string;
    mode: "staff" | "chords";
    images: string[];
  }) =>
    fetch("/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => asJson<{ text: string; warning?: string | null }>(r)),
};
