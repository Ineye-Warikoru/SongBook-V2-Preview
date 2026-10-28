"use client";
import { useEffect, useRef, useState } from "react";
import Drawer from "./Drawer";
import GlassButton from "./GlassButton";
import ToggleSwitch from "./ToggleSwitch";
import type { AIProviderConfig, AIProviderId, AppSettingsData, BarLayout, BarPosition, BarSize, AppMode } from "@/lib/types";
import { COLOR_THEMES } from "@/lib/types";

interface SettingsDrawerProps {
  settings: AppSettingsData;
  onUpdate: (patch: Partial<AppSettingsData>) => void;
  onResetSettings: () => void;
  onClose: () => void;
  scrollToAi?: boolean;
}

const PROVIDER_LABELS: Record<AIProviderId, string> = {
  claude: "Claude",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  groq: "Groq",
  "openai-compatible": "OpenAI-style service",
};

function ProviderForm({
  providerId,
  config,
  onSave,
  onRemove,
}: {
  providerId: AIProviderId;
  config: AIProviderConfig | undefined;
  onSave: (cfg: AIProviderConfig) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(!config?.apiKey);
  const [apiKey, setApiKey] = useState(config?.apiKey || "");
  const [model, setModel] = useState(config?.model || "");
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl || "");

  useEffect(() => {
    setApiKey(config?.apiKey || "");
    setModel(config?.model || "");
    setBaseUrl(config?.baseUrl || "");
    setEditing(!config?.apiKey);
  }, [providerId, config]);

  if (!editing && config?.apiKey) {
    return (
      <div className="song-card" style={{ marginTop: 10 }}>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-1)" }}>
          Key saved {config.model ? `· model: ${config.model}` : ""}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <GlassButton small onClick={() => setEditing(true)}>Change</GlassButton>
          <GlassButton small variant="danger" onClick={onRemove}>Remove key</GlassButton>
        </div>
      </div>
    );
  }

  return (
    <div className="song-card" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        type="text"
        placeholder="API key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      {(providerId === "openrouter" || providerId === "openai-compatible" || providerId === "groq" || providerId === "gemini" || providerId === "claude") && (
        <input
          type="text"
          placeholder={providerId === "claude" ? "Model (optional, e.g. claude-sonnet-4-5)" : "Model name"}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      )}
      {providerId === "openai-compatible" && (
        <input
          type="text"
          placeholder="Base URL, e.g. https://your-service/v1"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      )}
      <GlassButton
        small
        variant="primary"
        onClick={() => {
          if (!apiKey.trim()) return;
          onSave({ apiKey: apiKey.trim(), model: model.trim() || undefined, baseUrl: baseUrl.trim() || undefined });
          setEditing(false);
        }}
      >
        Save key
      </GlassButton>
    </div>
  );
}

export default function SettingsDrawer({ settings, onUpdate, onResetSettings, onClose, scrollToAi }: SettingsDrawerProps) {
  const aiRef = useRef<HTMLDivElement>(null);
  const [customHex, setCustomHex] = useState(settings.customColor);

  useEffect(() => {
    if (scrollToAi && aiRef.current) {
      setTimeout(() => aiRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [scrollToAi]);

  const bar = settings.bar;

  function updateBar(patch: Partial<typeof bar>) {
    onUpdate({ bar: { ...bar, ...patch } });
  }

  return (
    <Drawer title="Settings" onClose={onClose} settingsWidth>
      <p style={{ textTransform: "uppercase", fontSize: 12, letterSpacing: "0.08em", color: "var(--text-2)", margin: "0 0 10px" }}>
        Appearance
      </p>

      <p style={{ fontWeight: 600, margin: "0 0 8px" }}>Mode</p>
      <div className="segmented-group" style={{ marginBottom: 18 }}>
        {(["light", "dark", "auto"] as AppMode[]).map((m) => (
          <GlassButton key={m} variant={settings.mode === m ? "primary" : "default"} onClick={() => onUpdate({ mode: m })}>
            {m[0].toUpperCase() + m.slice(1)}
          </GlassButton>
        ))}
      </div>

      <p style={{ fontWeight: 600, margin: "0 0 8px" }}>Colour theme</p>
      <div className="segmented-grid" style={{ marginBottom: 14 }}>
        {Object.entries(COLOR_THEMES).map(([id, [c1]]) => (
          <button
            key={id}
            onClick={() => onUpdate({ theme: id })}
            className="glass-btn"
            style={{
              flexDirection: "column",
              gap: 6,
              padding: "10px 6px",
              background: settings.theme === id ? "linear-gradient(135deg, var(--accent-1), var(--accent-2))" : undefined,
              color: settings.theme === id ? "#fff" : undefined,
            }}
          >
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: c1, display: "block", border: "1px solid rgba(255,255,255,0.4)" }} />
            {id[0].toUpperCase() + id.slice(1)}
          </button>
        ))}
        <button
          onClick={() => onUpdate({ theme: "custom" })}
          className="glass-btn"
          style={{
            flexDirection: "column",
            gap: 6,
            padding: "10px 6px",
            background: settings.theme === "custom" ? "linear-gradient(135deg, var(--accent-1), var(--accent-2))" : undefined,
            color: settings.theme === "custom" ? "#fff" : undefined,
          }}
        >
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: settings.customColor, display: "block", border: "1px solid rgba(255,255,255,0.4)" }} />
          Custom
        </button>
      </div>

      <p style={{ fontWeight: 600, margin: "0 0 8px" }}>Custom colour (hex code)</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(customHex) ? customHex : "#2a7de1"}
          onChange={(e) => setCustomHex(e.target.value)}
          style={{ width: 44, height: 40, padding: 0, border: "none", borderRadius: 10, background: "none" }}
        />
        <input type="text" value={customHex} onChange={(e) => setCustomHex(e.target.value)} style={{ flex: 1 }} />
        <GlassButton onClick={() => onUpdate({ theme: "custom", customColor: customHex })}>Use</GlassButton>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 0, marginBottom: 20 }}>
        Type a hex code such as #1E88E5, or tap the square to pick one.
      </p>

      <div ref={aiRef} />
      <p style={{ textTransform: "uppercase", fontSize: 12, letterSpacing: "0.08em", color: "var(--text-2)", margin: "0 0 10px" }}>
        AI Transcription
      </p>
      <div className="segmented-group" style={{ marginBottom: 6, flexWrap: "wrap" }}>
        {(Object.keys(PROVIDER_LABELS) as AIProviderId[]).map((p) => (
          <GlassButton
            key={p}
            small
            variant={settings.aiProvider === p ? "primary" : "default"}
            onClick={() => onUpdate({ aiProvider: p })}
          >
            {PROVIDER_LABELS[p]}
          </GlassButton>
        ))}
      </div>
      <ProviderForm
        providerId={settings.aiProvider}
        config={settings.aiProviders[settings.aiProvider]}
        onSave={(cfg) =>
          onUpdate({ aiProviders: { ...settings.aiProviders, [settings.aiProvider]: cfg } })
        }
        onRemove={() => {
          const next = { ...settings.aiProviders };
          delete next[settings.aiProvider];
          onUpdate({ aiProviders: next });
        }}
      />
      <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 20, marginBottom: 20 }}>
        Each service keeps its own saved key, billed to you. Your key stays on this server and is only used to call that service.
      </p>

      <p style={{ textTransform: "uppercase", fontSize: 12, letterSpacing: "0.08em", color: "var(--text-2)", margin: "0 0 10px" }}>
        Prev and Next
      </p>
      <ToggleSwitch label="Show the floating bar" checked={bar.enabled} onChange={(v) => updateBar({ enabled: v })} />

      <p style={{ fontWeight: 600, margin: "14px 0 8px" }}>It switches between</p>
      <div className="segmented-group" style={{ marginBottom: 14 }}>
        <GlassButton variant={bar.mode === "songs" ? "primary" : "default"} onClick={() => updateBar({ mode: "songs" })}>
          Songs in my setlist
        </GlassButton>
        <GlassButton variant={bar.mode === "pages" ? "primary" : "default"} onClick={() => updateBar({ mode: "pages" })}>
          Pages of the PDF
        </GlassButton>
      </div>

      <p style={{ fontWeight: 600, margin: "0 0 8px" }}>Position</p>
      <div className="segmented-grid" style={{ marginBottom: 14 }}>
        {(["bottom-center", "bottom-left", "bottom-right", "sides", "custom"] as BarPosition[]).map((p) => (
          <GlassButton key={p} variant={bar.position === p ? "primary" : "default"} onClick={() => updateBar({ position: p })}>
            {p === "bottom-center" ? "Bottom centre" : p === "bottom-left" ? "Bottom left" : p === "bottom-right" ? "Bottom right" : p === "sides" ? "Sides" : "Custom"}
          </GlassButton>
        ))}
      </div>

      <p style={{ fontWeight: 600, margin: "0 0 8px" }}>Layout</p>
      <div className="segmented-group" style={{ marginBottom: 14 }}>
        {(["horizontal", "vertical"] as BarLayout[]).map((l) => (
          <GlassButton key={l} variant={bar.layout === l ? "primary" : "default"} onClick={() => updateBar({ layout: l })}>
            {l[0].toUpperCase() + l.slice(1)}
          </GlassButton>
        ))}
      </div>

      <p style={{ fontWeight: 600, margin: "0 0 8px" }}>Size</p>
      <div className="segmented-group" style={{ marginBottom: 14 }}>
        {(["small", "medium", "large"] as BarSize[]).map((s) => (
          <GlassButton key={s} variant={bar.size === s ? "primary" : "default"} onClick={() => updateBar({ size: s })}>
            {s[0].toUpperCase() + s.slice(1)}
          </GlassButton>
        ))}
      </div>

      <ToggleSwitch label="Make it draggable" checked={bar.draggable} onChange={(v) => updateBar({ draggable: v })} />
      <ToggleSwitch label="Lock its position" checked={bar.locked} onChange={(v) => updateBar({ locked: v })} />

      <p style={{ fontWeight: 600, margin: "14px 0 4px", display: "flex", justifyContent: "space-between" }}>
        Coordinates <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-2)" }}>px from the top left</span>
      </p>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="X"
          value={bar.x ?? ""}
          onChange={(e) => updateBar({ x: e.target.value === "" ? null : Number(e.target.value), position: "custom" })}
          style={{ flex: 1 }}
        />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Y"
          value={bar.y ?? ""}
          onChange={(e) => updateBar({ y: e.target.value === "" ? null : Number(e.target.value), position: "custom" })}
          style={{ flex: 1 }}
        />
      </div>
      <GlassButton onClick={() => updateBar({ position: "bottom-center", x: null, y: null })}>Reset position</GlassButton>

      <ToggleSwitch label="Show the song or page number" checked={bar.showNumber} onChange={(v) => updateBar({ showNumber: v })} />
      <ToggleSwitch label="Scroll to the top after switching song" checked={bar.scrollToTop} onChange={(v) => updateBar({ scrollToTop: v })} />
      <ToggleSwitch
        label={`Wrap around at the ends (${bar.mode})`}
        checked={bar.wrap}
        onChange={(v) => updateBar({ wrap: v })}
      />

      <div style={{ marginTop: 26, marginBottom: 10 }}>
        <GlassButton onClick={onResetSettings}>Reset settings</GlassButton>
      </div>
    </Drawer>
  );
}
