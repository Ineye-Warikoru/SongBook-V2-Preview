"use client";
import { useEffect, useRef, useState } from "react";
import GlassButton from "./GlassButton";

interface TwoTapButtonProps {
  label: string;
  armedLabel: string;
  onConfirm: () => void;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}

export default function TwoTapButton({ label, armedLabel, onConfirm, className = "", title, children }: TwoTapButtonProps) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!armed) return;
    function onDocClick(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setArmed(false);
      }
    }
    document.addEventListener("pointerdown", onDocClick);
    timerRef.current = setTimeout(() => setArmed(false), 4000);
    return () => {
      document.removeEventListener("pointerdown", onDocClick);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [armed]);

  function handleClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    onConfirm();
  }

  return (
    <GlassButton
      ref={btnRef}
      onClick={handleClick}
      variant={armed ? "danger" : "default"}
      className={className}
      title={title}
    >
      {children}
      <span>{armed ? armedLabel : label}</span>
    </GlassButton>
  );
}
