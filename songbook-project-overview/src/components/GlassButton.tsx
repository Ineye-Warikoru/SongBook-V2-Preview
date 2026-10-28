"use client";
import { forwardRef, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "default" | "primary" | "danger";
  small?: boolean;
  className?: string;
}

function GlassButtonInner(
  {
    children,
    variant = "default",
    small,
    className = "",
    onPointerDown,
    disabled,
    ...rest
  }: GlassButtonProps,
  forwardedRef: React.ForwardedRef<HTMLButtonElement>,
) {
  const innerRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();

  function setRefs(node: HTMLButtonElement | null) {
    innerRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!reducedMotion && innerRef.current && !disabled) {
      const rect = innerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Math.max(rect.width, rect.height) * 1.4;

      const ripple = document.createElement("span");
      ripple.className = "btn-ripple";
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      innerRef.current.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());

      const sweep = document.createElement("span");
      sweep.className = "btn-sweep";
      innerRef.current.appendChild(sweep);
      sweep.addEventListener("animationend", () => sweep.remove());
    }
    onPointerDown?.(e);
  }

  const variantClass = variant === "primary" ? "primary" : variant === "danger" ? "danger-armed" : "";

  return (
    <button
      ref={setRefs}
      className={`glass-btn ${variantClass} ${small ? "small" : ""} ${className}`}
      onPointerDown={handlePointerDown}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

const GlassButton = forwardRef(GlassButtonInner);
export default GlassButton;
