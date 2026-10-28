"use client";
import { useLayoutEffect, useRef, useState } from "react";

export interface PillOption {
  id: string;
  label: string;
}

interface PillSwitchProps {
  options: PillOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function PillSwitch({ options, value, onChange, className = "" }: PillSwitchProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [thumb, setThumb] = useState({ left: 0, width: 0 });
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ startX: number; startLeft: number } | null>(null);

  function measure(id: string) {
    const track = trackRef.current;
    const btn = btnRefs.current.get(id);
    if (!track || !btn) return null;
    const trackRect = track.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    return { left: btnRect.left - trackRect.left + track.scrollLeft, width: btnRect.width };
  }

  useLayoutEffect(() => {
    const pos = measure(value);
    if (pos) setThumb(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  function handlePointerDown(e: React.PointerEvent) {
    const track = trackRef.current;
    if (!track) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = { startX: e.clientX, startLeft: thumb.left };
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging || !dragState.current || !trackRef.current) return;
    const dx = e.clientX - dragState.current.startX;
    const track = trackRef.current;
    const maxLeft = track.clientWidth - thumb.width;
    let newLeft = dragState.current.startLeft + dx;
    newLeft = Math.max(-6, Math.min(maxLeft + 6, newLeft));
    setThumb((t) => ({ ...t, left: newLeft }));
  }

  function handlePointerUp() {
    if (!dragging) return;
    setDragging(false);
    const track = trackRef.current;
    if (!track) return;
    const thumbCenter = thumb.left + thumb.width / 2;
    let closestId = value;
    let closestDist = Infinity;
    for (const opt of options) {
      const pos = measure(opt.id);
      if (!pos) continue;
      const center = pos.left + pos.width / 2;
      const dist = Math.abs(center - thumbCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = opt.id;
      }
    }
    if (closestId !== value) onChange(closestId);
    else {
      const pos = measure(value);
      if (pos) setThumb(pos);
    }
  }

  return (
    <div
      ref={trackRef}
      className={`pill-track ${className}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className={`pill-thumb ${dragging ? "dragging" : ""}`}
        style={{ left: thumb.left, width: thumb.width }}
        onPointerDown={handlePointerDown}
      />
      {options.map((opt) => (
        <div
          key={opt.id}
          ref={(el) => {
            if (el) btnRefs.current.set(opt.id, el);
          }}
          className={`pill-option ${value === opt.id ? "active" : ""}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </div>
      ))}
    </div>
  );
}
