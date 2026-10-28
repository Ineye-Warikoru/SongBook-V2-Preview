import { db } from "@/db";
import { songVersions, setlistEntries, librarySongs } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const versionId = Number(id);
  try {
    const [version] = await db.select().from(songVersions).where(eq(songVersions.id, versionId));
    if (!version) return Response.json({ error: "Not found" }, { status: 404 });
    const [song] = await db.select().from(librarySongs).where(eq(librarySongs.id, version.songId));
    return Response.json({
      id: version.id,
      title: song?.title ?? "",
      label: version.label,
      key: version.key,
      capo: version.capo,
      kind: version.kind,
      status: version.status,
      hasPdf: !!version.pdfData,
      transcriptionType: version.transcriptionType,
      transcriptionText: version.transcriptionText,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const versionId = Number(id);
  try {
    await db.delete(setlistEntries).where(eq(setlistEntries.versionId, versionId));
    await db
      .update(songVersions)
      .set({
        status: "not_downloaded",
        pdfData: null,
        pdfMime: null,
        pageCount: null,
        transcriptionType: null,
        transcriptionText: null,
        transcriptionMeta: null,
        updatedAt: new Date(),
      })
      .where(eq(songVersions.id, versionId));
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to delete" }, { status: 500 });
  }
}
