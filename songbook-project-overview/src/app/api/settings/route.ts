import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS } from "@/lib/types";

export const dynamic = "force-dynamic";

async function ensureRow() {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  if (row) return row;
  const [created] = await db
    .insert(appSettings)
    .values({ id: 1, data: DEFAULT_SETTINGS as unknown as Record<string, unknown> })
    .returning();
  return created;
}

export async function GET() {
  try {
    const row = await ensureRow();
    const merged = { ...DEFAULT_SETTINGS, ...(row.data as object) };
    return Response.json({ settings: merged });
  } catch (err) {
    console.error(err);
    return Response.json({ settings: DEFAULT_SETTINGS });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const row = await ensureRow();
    const merged = { ...DEFAULT_SETTINGS, ...(row.data as object), ...body };
    await db
      .update(appSettings)
      .set({ data: merged, updatedAt: new Date() })
      .where(eq(appSettings.id, 1));
    return Response.json({ ok: true, settings: merged });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await db
      .update(appSettings)
      .set({ data: DEFAULT_SETTINGS as unknown as Record<string, unknown>, updatedAt: new Date() })
      .where(eq(appSettings.id, 1));
    return Response.json({ ok: true, settings: DEFAULT_SETTINGS });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to reset settings" }, { status: 500 });
  }
}
