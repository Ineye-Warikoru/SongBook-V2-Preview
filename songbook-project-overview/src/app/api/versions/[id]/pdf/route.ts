import { db } from "@/db";
import { songVersions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const versionId = Number(id);
  try {
    const [version] = await db.select().from(songVersions).where(eq(songVersions.id, versionId));
    if (!version || !version.pdfData) {
      return Response.json({ error: "Couldn't read that PDF" }, { status: 404 });
    }
    return Response.json({ data: version.pdfData, mime: version.pdfMime || "application/pdf" });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Couldn't read that PDF" }, { status: 500 });
  }
}
