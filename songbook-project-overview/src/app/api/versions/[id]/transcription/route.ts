import { db } from "@/db";
import { songVersions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const versionId = Number(id);
  try {
    const body = await req.json();
    const { type, text } = body as { type: "staff" | "chords"; text: string };
    if (!type || !text) {
      return Response.json({ error: "Missing transcription data" }, { status: 400 });
    }
    await db
      .update(songVersions)
      .set({ transcriptionType: type, transcriptionText: text, updatedAt: new Date() })
      .where(eq(songVersions.id, versionId));
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to save transcription" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const versionId = Number(id);
  try {
    await db
      .update(songVersions)
      .set({ transcriptionType: null, transcriptionText: null, transcriptionMeta: null })
      .where(eq(songVersions.id, versionId));
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to clear transcription" }, { status: 500 });
  }
}
