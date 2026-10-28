import { db } from "@/db";
import { setlistEntries } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = Number(id);
  try {
    const body = await req.json();
    const { move, keyOverride } = body as { move?: "left" | "right"; keyOverride?: string };

    if (keyOverride !== undefined) {
      await db.update(setlistEntries).set({ keyOverride }).where(eq(setlistEntries.id, entryId));
      return Response.json({ ok: true });
    }

    if (move) {
      const all = await db.select().from(setlistEntries).orderBy(asc(setlistEntries.position));
      const idx = all.findIndex((e) => e.id === entryId);
      if (idx === -1) return Response.json({ error: "Not found" }, { status: 404 });
      const swapIdx = move === "left" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= all.length) return Response.json({ ok: true });
      const a = all[idx];
      const b = all[swapIdx];
      await db.update(setlistEntries).set({ position: b.position }).where(eq(setlistEntries.id, a.id));
      await db.update(setlistEntries).set({ position: a.position }).where(eq(setlistEntries.id, b.id));
      return Response.json({ ok: true });
    }

    return Response.json({ error: "No valid update provided" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to update setlist" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = Number(id);
  try {
    await db.delete(setlistEntries).where(eq(setlistEntries.id, entryId));
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to remove from setlist" }, { status: 500 });
  }
}
