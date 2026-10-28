export type VersionKind = "chords" | "score";
export type VersionStatus = "not_downloaded" | "downloaded" | "added";

export interface SongVersionDTO {
  id: number;
  songId: number;
  label: string;
  key: string | null;
  capo: number | null;
  kind: VersionKind;
  fileName: string;
  status: VersionStatus;
  pageCount: number | null;
  hasTranscription: boolean;
  transcriptionType: "staff" | "chords" | null;
  setlistPosition: number | null;
}

export interface LibrarySongDTO {
  id: number;
  title: string;
  letter: string;
  versions: SongVersionDTO[];
}

export interface SetlistEntryDTO {
  id: number;
  versionId: number;
  position: number;
  keyOverride: string | null;
  songTitle: string;
  label: string;
  originalKey: string | null;
}

export type BarMode = "songs" | "pages";
export type BarPosition =
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "sides"
  | "custom";
export type BarSize = "small" | "medium" | "large";
export type BarLayout = "horizontal" | "vertical";
export type AppMode = "light" | "dark" | "auto";

export interface FloatingBarSettings {
  enabled: boolean;
  mode: BarMode;
  position: BarPosition;
  layout: BarLayout;
  size: BarSize;
  draggable: boolean;
  locked: boolean;
  x: number | null;
  y: number | null;
  showNumber: boolean;
  scrollToTop: boolean;
  wrap: boolean;
}

export type AIProviderId = "claude" | "gemini" | "openrouter" | "groq" | "openai-compatible";

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface AppSettingsData {
  mode: AppMode;
  theme: string;
  customColor: string;
  bar: FloatingBarSettings;
  aiProvider: AIProviderId;
  aiProviders: Partial<Record<AIProviderId, AIProviderConfig>>;
}

export const DEFAULT_BAR_SETTINGS: FloatingBarSettings = {
  enabled: true,
  mode: "songs",
  position: "bottom-center",
  layout: "horizontal",
  size: "medium",
  draggable: false,
  locked: false,
  x: null,
  y: null,
  showNumber: true,
  scrollToTop: true,
  wrap: true,
};

export const DEFAULT_SETTINGS: AppSettingsData = {
  mode: "auto",
  theme: "ocean",
  customColor: "#E22400",
  bar: DEFAULT_BAR_SETTINGS,
  aiProvider: "claude",
  aiProviders: {},
};

export const COLOR_THEMES: Record<string, [string, string]> = {
  ocean: ["#1E88E5", "#3F51B5"],
  violet: ["#7C4DFF", "#9C27B0"],
  emerald: ["#10B981", "#059669"],
  rose: ["#F43F5E", "#EC4899"],
  amber: ["#F59E0B", "#D97706"],
  graphite: ["#64748B", "#334155"],
  sunset: ["#FB923C", "#EC4899"],
  aurora: ["#14B8A6", "#6366F1"],
  lagoon: ["#06B6D4", "#0EA5E9"],
  berry: ["#C026D3", "#9333EA"],
  forest: ["#22C55E", "#15803D"],
  crimson: ["#EF4444", "#B91C1C"],
  teal: ["#14B8A6", "#0D9488"],
  indigo: ["#6366F1", "#4338CA"],
  sky: ["#38BDF8", "#0284C7"],
  coral: ["#FB7185", "#F97316"],
  lime: ["#A3E635", "#65A30D"],
  mocha: ["#A16207", "#78350F"],
  candy: ["#F0ABFC", "#D946EF"],
};
