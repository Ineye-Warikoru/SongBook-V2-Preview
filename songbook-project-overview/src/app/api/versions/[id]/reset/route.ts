import { db } from "@/db";
import { songVersions, setlistEntries } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
        updatedAt: new Date(),
      })
      .where(eq(songVersions.id, versionId));
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to reset" }, { status: 500 });
  }
}
