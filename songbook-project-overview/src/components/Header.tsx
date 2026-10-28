"use client";
import Image from "next/image";

interface HeaderProps {
  resolvedMode: "light" | "dark";
  onToggleMode: () => void;
  onOpenSettings: () => void;
  helpText?: string;
}

export default function Header({ resolvedMode, onToggleMode, onOpenSettings, helpText }: HeaderProps) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Image src="/images/kasg-logo.png" alt="kasg.co.uk" width={120} height={40} style={{ width: 110, height: "auto" }} />
        <h1 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, margin: 0 }}>Songbook</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        {helpText && (
          <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 420, margin: 0, textAlign: "right" }}>{helpText}</p>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="icon-btn" onClick={onOpenSettings} title="Settings" aria-label="Settings">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none">
              <path d="M4 7h10M18 7h2M4 17h2M8 17h12M9 4.5v5M16 14.5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="9" cy="7" r="2.2" fill="currentColor" />
              <circle cx="16" cy="17" r="2.2" fill="currentColor" />
            </svg>
          </button>
          <button className="icon-btn" onClick={onToggleMode} title="Switch light/dark" aria-label="Switch light/dark">
            {resolvedMode === "dark" ? (
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none">
                <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none">
                <circle cx="12" cy="12" r="4.5" fill="currentColor" />
                <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
