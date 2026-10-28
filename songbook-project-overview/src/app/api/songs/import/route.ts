import { db } from "@/db";
import { librarySongs, songVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { extractPdfNames, parsePdfFileName, letterForTitle, normaliseSearch } from "@/lib/importParser";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text: string = body?.text ?? "";
    if (!text || typeof text !== "string") {
      return Response.json({ error: "No text provided" }, { status: 400 });
    }

    const fileNames = extractPdfNames(text);
    if (fileNames.length === 0) {
      return Response.json({ error: "No .pdf file names were found in that paste" }, { status: 400 });
    }

    let added = 0;
    let skipped = 0;

    for (const fileName of fileNames) {
      const parsed = parsePdfFileName(fileName);
      const title = parsed.title;
      if (!title) continue;
      const letter = letterForTitle(title);
      const searchKey = normaliseSearch(title);

      let [song] = await db.select().from(librarySongs).where(eq(librarySongs.title, title));
      if (!song) {
        [song] = await db
          .insert(librarySongs)
          .values({ title, letter, searchKey })
          .returning();
      }

      const existingVersions = await db
        .select()
        .from(songVersions)
        .where(eq(songVersions.songId, song.id));

      const dupe = existingVersions.find(
        (v) => v.fileName.toLowerCase() === fileName.toLowerCase() || v.label === parsed.label,
      );
      if (dupe) {
        skipped++;
        continue;
      }

      await db.insert(songVersions).values({
        songId: song.id,
        label: parsed.label,
        key: parsed.key,
        capo: parsed.capo,
        kind: parsed.kind,
        fileName: parsed.fileName,
        status: "not_downloaded",
      });
      added++;
    }

    return Response.json({ ok: true, added, skipped, totalFound: fileNames.length });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Could not import that list" }, { status: 500 });
  }
}
