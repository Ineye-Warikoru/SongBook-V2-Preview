import { db } from "@/db";
import { librarySongs, songVersions, setlistEntries } from "@/db/schema";
import { asc } from "drizzle-orm";
import type { LibrarySongDTO, SongVersionDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const songs = await db.select().from(librarySongs).orderBy(asc(librarySongs.searchKey));
    const versions = await db.select().from(songVersions).orderBy(asc(songVersions.label));
    const setlist = await db.select().from(setlistEntries);

    const setlistByVersion = new Map(setlist.map((s) => [s.versionId, s]));

    const versionsBySong = new Map<number, SongVersionDTO[]>();
    for (const v of versions) {
      const dto: SongVersionDTO = {
        id: v.id,
        songId: v.songId,
        label: v.label,
        key: v.key,
        capo: v.capo,
        kind: v.kind as "chords" | "score",
        fileName: v.fileName,
        status: v.status as SongVersionDTO["status"],
        pageCount: v.pageCount,
        hasTranscription: !!v.transcriptionText,
        transcriptionType: (v.transcriptionType as "staff" | "chords" | null) ?? null,
        setlistPosition: setlistByVersion.get(v.id)?.position ?? null,
      };
      const list = versionsBySong.get(v.songId) ?? [];
      list.push(dto);
      versionsBySong.set(v.songId, list);
    }

    const result: LibrarySongDTO[] = songs.map((s) => ({
      id: s.id,
      title: s.title,
      letter: s.letter,
      versions: versionsBySong.get(s.id) ?? [],
    }));

    return Response.json({ songs: result });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to load library" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await db.delete(librarySongs);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to clear library" }, { status: 500 });
  }
}
