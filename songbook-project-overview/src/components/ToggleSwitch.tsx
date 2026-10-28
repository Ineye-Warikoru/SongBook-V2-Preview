"use client";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function ToggleSwitch({ checked, onChange, label, disabled }: ToggleSwitchProps) {
  return (
    <div className="toggle-row">
      {label && <span style={{ color: "var(--text-1)", fontSize: 14.5 }}>{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="toggle-switch"
        data-on={checked}
        onClick={() => !disabled && onChange(!checked)}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}
