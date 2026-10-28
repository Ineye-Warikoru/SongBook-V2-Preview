import { db } from "@/db";
import { setlistEntries, songVersions, librarySongs } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import type { SetlistEntryDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await db.select().from(setlistEntries).orderBy(asc(setlistEntries.position));
    const result: SetlistEntryDTO[] = [];
    for (const e of entries) {
      const [version] = await db.select().from(songVersions).where(eq(songVersions.id, e.versionId));
      if (!version) continue;
      const [song] = await db.select().from(librarySongs).where(eq(librarySongs.id, version.songId));
      result.push({
        id: e.id,
        versionId: e.versionId,
        position: e.position,
        keyOverride: e.keyOverride,
        songTitle: song?.title ?? "Unknown",
        label: version.label,
        originalKey: version.key,
      });
    }
    return Response.json({ entries: result });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to load setlist" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const versionId = Number(body?.versionId);
    if (!versionId) return Response.json({ error: "versionId required" }, { status: 400 });

    const existing = await db.select().from(setlistEntries).where(eq(setlistEntries.versionId, versionId));
    if (existing.length > 0) {
      return Response.json({ ok: true, entry: existing[0] });
    }

    const all = await db.select().from(setlistEntries);
    const nextPosition = all.length === 0 ? 1 : Math.max(...all.map((e) => e.position)) + 1;

    const [version] = await db.select().from(songVersions).where(eq(songVersions.id, versionId));

    const [entry] = await db
      .insert(setlistEntries)
      .values({ versionId, position: nextPosition, keyOverride: version?.key ?? null })
      .returning();

    return Response.json({ ok: true, entry });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to add to setlist" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await db.delete(setlistEntries);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to clear setlist" }, { status: 500 });
  }
}
