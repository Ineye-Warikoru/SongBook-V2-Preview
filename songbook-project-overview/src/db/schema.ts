import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const librarySongs = pgTable(
  "library_songs",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    letter: text("letter").notNull(),
    searchKey: text("search_key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    titleIdx: uniqueIndex("library_songs_title_idx").on(table.title),
  }),
);

export const songVersions = pgTable("song_versions", {
  id: serial("id").primaryKey(),
  songId: integer("song_id")
    .notNull()
    .references(() => librarySongs.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  key: text("key"),
  capo: integer("capo"),
  kind: text("kind").notNull().default("chords"), // 'chords' | 'score'
  fileName: text("file_name").notNull(),
  status: text("status").notNull().default("not_downloaded"), // not_downloaded | downloaded | added
  pdfData: text("pdf_data"), // base64 encoded pdf bytes
  pdfMime: text("pdf_mime"),
  pageCount: integer("page_count"),
  transcriptionType: text("transcription_type"), // 'staff' | 'chords'
  transcriptionText: text("transcription_text"),
  transcriptionMeta: jsonb("transcription_meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const setlistEntries = pgTable(
  "setlist_entries",
  {
    id: serial("id").primaryKey(),
    versionId: integer("version_id")
      .notNull()
      .references(() => songVersions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    keyOverride: text("key_override"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    versionIdx: uniqueIndex("setlist_entries_version_idx").on(table.versionId),
  }),
);

export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
