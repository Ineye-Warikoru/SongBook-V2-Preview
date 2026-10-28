import { db } from "@/db";
import { librarySongs, songVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { letterForTitle, normaliseSearch, parsePdfFileName } from "@/lib/importParser";

export const dynamic = "force-dynamic";

function bufferToBase64(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("base64");
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    if (!files || files.length === 0) {
      return Response.json({ error: "No files received" }, { status: 400 });
    }

    const allVersions = await db.select().from(songVersions);
    const results: { fileName: string; versionId: number; matched: boolean }[] = [];

    for (const file of files) {
      if (!file || typeof file === "string") continue;
      const originalName = file.name || "song.pdf";
      const arrayBuffer = await file.arrayBuffer();
      if (arrayBuffer.byteLength === 0) continue;
      const base64 = bufferToBase64(arrayBuffer);
      const mime = file.type || "application/pdf";

      const match = allVersions.find(
        (v) => v.fileName.toLowerCase() === originalName.toLowerCase() && v.status !== "added",
      );

      if (match) {
        await db
          .update(songVersions)
          .set({ status: "added", pdfData: base64, pdfMime: mime, updatedAt: new Date() })
          .where(eq(songVersions.id, match.id));
        match.status = "added";
        results.push({ fileName: originalName, versionId: match.id, matched: true });
        continue;
      }

      // No match: create an ad-hoc song + version entry for this PDF.
      const parsed = parsePdfFileName(originalName);
      const title = parsed.title || originalName.replace(/\.pdf$/i, "");
      const letter = letterForTitle(title);
      const searchKey = normaliseSearch(title);

      let [song] = await db.select().from(librarySongs).where(eq(librarySongs.title, title));
      if (!song) {
        [song] = await db.insert(librarySongs).values({ title, letter, searchKey }).returning();
      }

      const [newVersion] = await db
        .insert(songVersions)
        .values({
          songId: song.id,
          label: parsed.label,
          key: parsed.key,
          capo: parsed.capo,
          kind: parsed.kind,
          fileName: originalName,
          status: "added",
          pdfData: base64,
          pdfMime: mime,
        })
        .returning();

      allVersions.push(newVersion);
      results.push({ fileName: originalName, versionId: newVersion.id, matched: false });
    }

    return Response.json({ ok: true, results, count: results.length });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Could not store those PDFs" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const stored = await db.select().from(songVersions);
    for (const v of stored) {
      if (v.pdfData) {
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
          .where(eq(songVersions.id, v.id));
      }
    }
    const { setlistEntries } = await import("@/db/schema");
    await db.delete(setlistEntries);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to delete all PDFs" }, { status: 500 });
  }
}
