import { db } from "@/db";
import { songVersions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const versionId = Number(id);
  try {
    const [version] = await db.select().from(songVersions).where(eq(songVersions.id, versionId));
    if (!version) return Response.json({ error: "Not found" }, { status: 404 });
    if (version.status === "not_downloaded") {
      await db
        .update(songVersions)
        .set({ status: "downloaded", updatedAt: new Date() })
        .where(eq(songVersions.id, versionId));
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}
