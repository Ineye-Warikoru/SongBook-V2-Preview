"use client";

export type SongStatus = "not_downloaded" | "downloaded" | "added" | "in_setlist";

const COLORS: Record<SongStatus, string> = {
  not_downloaded: "#4f8ef0",
  downloaded: "#38c976",
  added: "#e0b33a",
  in_setlist: "#38c976",
};

export default function StatusIcon({ status, pop }: { status: SongStatus; pop?: boolean }) {
  const color = COLORS[status];
  const isCheck = status === "added" || status === "in_setlist";

  return (
    <span
      className={pop ? "chip-pop" : ""}
      style={{ display: "inline-flex", width: 15, height: 15, color }}
    >
      {isCheck ? (
        <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
          <path d="M4 12.5L9.5 18L20 6" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
          <path
            d="M12 15V4M12 4L7.5 8.5M12 4l4.5 4.5"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

export function statusFor(status: "not_downloaded" | "downloaded" | "added", inSetlist: boolean): SongStatus {
  if (status === "added" && inSetlist) return "in_setlist";
  return status as SongStatus;
}
