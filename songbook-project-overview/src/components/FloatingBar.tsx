"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import type { FloatingBarSettings } from "@/lib/types";
import GlassButton from "./GlassButton";

interface FloatingBarProps {
  settings: FloatingBarSettings;
  label: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPositionChange: (x: number, y: number) => void;
}

function basePositionStyle(settings: FloatingBarSettings): React.CSSProperties {
  if (settings.position === "custom" && settings.x !== null && settings.y !== null) {
    return { left: settings.x, top: settings.y };
  }
  switch (settings.position) {
    case "bottom-left":
      return { left: 24, bottom: 28 };
    case "bottom-right":
      return { right: 24, bottom: 28 };
    case "sides":
      return { left: 12, top: "50%", transform: "translateY(-50%)" };
    case "bottom-center":
    default:
      return { left: "50%", bottom: 28, transform: "translateX(-50%)" };
  }
}

export default function FloatingBar({ settings, label, canPrev, canNext, onPrev, onNext, onPositionChange }: FloatingBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragInfo = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);

  const canDrag = settings.draggable && !settings.locked;

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragInfo.current || !barRef.current) return;
    const dx = e.clientX - dragInfo.current.startX;
    const dy = e.clientY - dragInfo.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragInfo.current.moved = true;
    const rect = barRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    const newX = Math.max(0, Math.min(maxX, dragInfo.current.originX + dx));
    const newY = Math.max(0, Math.min(maxY, dragInfo.current.originY + dy));
    setDragPos({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragInfo.current?.moved && dragPos) {
      onPositionChange(dragPos.x, dragPos.y);
    }
    dragInfo.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [dragPos, handlePointerMove, onPositionChange]);

  function handlePointerDown(e: React.PointerEvent) {
    if (!canDrag || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const style: React.CSSProperties = dragPos
    ? { left: dragPos.x, top: dragPos.y }
    : basePositionStyle(settings);

  return (
    <div
      ref={barRef}
      className={`floating-bar ${settings.layout === "vertical" ? "vertical" : ""} size-${settings.size}`}
      style={{ ...style, cursor: canDrag ? "grab" : "default", touchAction: canDrag ? "none" : "auto" }}
      onPointerDown={handlePointerDown}
    >
      <GlassButton small disabled={!canPrev} onClick={onPrev}>
        ‹ Prev
      </GlassButton>
      {settings.showNumber && (
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-1)", padding: "0 4px", whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}
      <GlassButton small disabled={!canNext} onClick={onNext}>
        Next ›
      </GlassButton>
    </div>
  );
}
