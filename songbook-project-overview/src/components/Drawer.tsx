"use client";
import { useRef, type ReactNode } from "react";
import GlassButton from "./GlassButton";

interface DrawerProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  settingsWidth?: boolean;
}

export default function Drawer({ title, onClose, children, settingsWidth }: DrawerProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function isTypingTarget(el: EventTarget | null) {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (isTypingTarget(e.target)) {
      touchStart.current = null;
      return;
    }
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (dx > 80 && Math.abs(dy) < 60) {
      onClose();
    }
    touchStart.current = null;
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div
        className={`drawer-panel ${settingsWidth ? "settings-panel" : ""}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-label={title}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h2>
          <GlassButton onClick={onClose}>Close</GlassButton>
        </div>
        {children}
      </div>
    </>
  );
}
