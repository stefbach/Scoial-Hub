"use client";

export type NetworkId = "facebook" | "instagram" | "linkedin";

export interface NetworkConfig {
  enabled: boolean;
  organic: boolean;
  ads: boolean;
}

export type NetworksState = Record<NetworkId, NetworkConfig>;

interface NetworkToggleProps {
  network: NetworkId;
  config: NetworkConfig;
  onChange: (config: NetworkConfig) => void;
}

const NETWORK_META: Record<NetworkId, { label: string; color: string; icon: React.ReactNode }> = {
  facebook: {
    label: "Facebook",
    color: "#1877f2",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073c0 6.026 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.42c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.49 0-1.955.926-1.955 1.874v2.25h3.328l-.532 3.49h-2.796v8.437C19.612 23.093 24 18.1 24 12.073z" />
      </svg>
    ),
  },
  instagram: {
    label: "Instagram",
    color: "#e1306c",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0a66c2",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
};

export function NetworkToggle({ network, config, onChange }: NetworkToggleProps) {
  const meta = NETWORK_META[network];

  return (
    <div
      className={[
        "card p-4 transition-all duration-200",
        config.enabled ? "ring-2 ring-offset-1" : "opacity-70",
      ].join(" ")}
      style={config.enabled ? ({ ["--tw-ring-color" as string]: meta.color } as React.CSSProperties) : undefined}
    >
      {/* En-tête : logo + nom + toggle principal */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span style={{ color: meta.color }}>{meta.icon}</span>
          <span className="text-sm font-semibold text-ink">{meta.label}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          onClick={() => onChange({ ...config, enabled: !config.enabled })}
          className={[
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
            config.enabled ? "bg-page" : "bg-hair",
          ].join(" ")}
        >
          <span className="sr-only">Activer {meta.label}</span>
          <span
            className={[
              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
              config.enabled ? "translate-x-4" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>

      {/* Options (visible si activé) */}
      {config.enabled && (
        <div className="mt-3 grid grid-cols-2 gap-2 animate-fade-in">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-hair bg-canvas px-3 py-2 text-sm hover:bg-card transition-colors">
            <input
              type="checkbox"
              checked={config.organic}
              onChange={(e) => onChange({ ...config, organic: e.target.checked })}
              className="h-4 w-4 rounded border-hair accent-page"
            />
            <span className="text-ink">Organique</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-hair bg-canvas px-3 py-2 text-sm hover:bg-card transition-colors">
            <input
              type="checkbox"
              checked={config.ads}
              onChange={(e) => onChange({ ...config, ads: e.target.checked })}
              className="h-4 w-4 rounded border-hair accent-page"
            />
            <span className="text-ink">SEA / Ads</span>
          </label>
        </div>
      )}
    </div>
  );
}
