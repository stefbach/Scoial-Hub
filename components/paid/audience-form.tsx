"use client";

import { useEffect, useRef, useState } from "react";
import { TagInput } from "@/components/ui/TagInput";
import { useT } from "@/lib/i18n";
import type { Audience } from "@/lib/types";

const LOCATION_SUGGESTIONS = [
  "Mauritius", "Réunion", "Madagascar", "Seychelles", "South Africa",
  "France", "United Kingdom", "United Arab Emirates", "Singapore",
  "Cape Verde", "Senegal", "Côte d'Ivoire", "West Africa", "East Africa",
];

const INTEREST_SUGGESTIONS = [
  "weight loss", "wellness", "nutrition", "fitness", "yoga", "running",
  "cooking", "healthy eating", "meditation", "mindfulness", "men's health",
  "women's health", "telehealth", "preventive care", "medical travel",
];

// ────────────────────────────────────────────────────────────────────────────
// Saved audience config
// ────────────────────────────────────────────────────────────────────────────
export interface SavedConfig {
  name: string;
  gender: "All" | "Women" | "Men";
  ageMin: number;
  ageMax: number;
  locations: string[];
  interests: string[];
}

export function makeSavedConfig(audience?: Audience): SavedConfig {
  return {
    name: audience?.name ?? "",
    gender: (audience?.config?.gender as SavedConfig["gender"]) ?? "All",
    ageMin: Number(audience?.config?.ageRange?.split("-")[0] ?? 18),
    ageMax: Number(audience?.config?.ageRange?.split("-")[1] ?? 65),
    locations: audience?.config?.locations ?? [],
    interests: audience?.config?.interests ?? [],
  };
}

export function savedValid(c: SavedConfig) {
  return c.name.trim().length > 0 && c.locations.length > 0;
}

export function estimateSavedReach(c: SavedConfig) {
  let r = 2_000_000;
  if (c.gender !== "All") r *= 0.5;
  const ageWidth = Math.max(1, c.ageMax - c.ageMin);
  r *= ageWidth / 80;
  if (c.locations.length > 0) r *= Math.pow(0.7, c.locations.length);
  if (c.interests.length > 0) r *= Math.pow(0.8, c.interests.length);
  r = Math.max(1000, Math.round(r));
  return r;
}

export function SavedFields({
  config,
  onChange,
}: {
  config: SavedConfig;
  onChange: (c: SavedConfig) => void;
}) {
  const t = useT();
  const set = <K extends keyof SavedConfig>(k: K, v: SavedConfig[K]) =>
    onChange({ ...config, [k]: v });

  const GENDER_LABELS: Record<"All" | "Women" | "Men", string> = {
    All: t("Tous", "All"),
    Women: t("Femmes", "Women"),
    Men: t("Hommes", "Men"),
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-2xs font-medium text-muted">{t("Nom de l'audience", "Audience name")}</label>
        <input
          value={config.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Women 35-55 Mauritius — Wellness"
          className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>

      <div>
        <div className="text-2xs font-medium text-muted">{t("Genre", "Gender")}</div>
        {/* flex-wrap pour éviter la disparition de "Hommes" en split view */}
        <div className="mt-1 flex flex-wrap gap-2">
          {(["All", "Women", "Men"] as const).map((g) => {
            const on = config.gender === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => set("gender", g)}
                className={`min-w-0 shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                  on
                    ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30"
                    : "border border-hair bg-card text-muted"
                }`}
              >
                {GENDER_LABELS[g]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-2xs font-medium text-muted">{t("Tranche d'âge", "Age range")}</div>
        <div className="mt-1 flex items-center gap-2 text-sm text-ink">
          <input
            type="number"
            min={13}
            max={120}
            value={config.ageMin}
            onChange={(e) => set("ageMin", Number(e.target.value))}
            className="w-16 rounded-md border-hair border-hair bg-card px-2 py-1.5 text-center focus:outline-none"
          />
          <span className="text-muted">{t("à", "to")}</span>
          <input
            type="number"
            min={13}
            max={120}
            value={config.ageMax}
            onChange={(e) => set("ageMax", Number(e.target.value))}
            className="w-16 rounded-md border-hair border-hair bg-card px-2 py-1.5 text-center focus:outline-none"
          />
          <span className="text-2xs text-muted">{t("Meta requiert un minimum de 13 ans", "Meta requires 13 minimum")}</span>
        </div>
      </div>

      <div>
        <div className="text-2xs font-medium text-muted">{t("Localisations", "Locations")}</div>
        <div className="mt-1">
          <SuggestingTagInput
            tags={config.locations}
            onChange={(v) => set("locations", v)}
            suggestions={LOCATION_SUGGESTIONS}
            placeholder={t("Ajouter un pays, une région ou une ville…", "Add country, region, or city…")}
          />
        </div>
      </div>

      <div>
        <div className="text-2xs font-medium text-muted">
          {t("Centres d'intérêt", "Interests")} <span className="text-muted">({t("optionnel", "optional")})</span>
        </div>
        <div className="mt-1">
          <SuggestingTagInput
            tags={config.interests}
            onChange={(v) => set("interests", v)}
            suggestions={INTEREST_SUGGESTIONS}
            placeholder={t("Rechercher des centres d'intérêt…", "Search interests…")}
          />
        </div>
        <div className="mt-1 text-2xs text-muted">
          {t("Meta propose des milliers de centres d'intérêt. Tapez pour rechercher.", "Meta has thousands of interests. Type to search.")}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Custom audience config
// ────────────────────────────────────────────────────────────────────────────
export interface CustomConfig {
  name: string;
  source: string;
  fileName?: string;
  fileSize?: number;
}

export function makeCustomConfig(audience?: Audience): CustomConfig {
  return {
    name: audience?.name ?? "",
    source: audience?.config?.source ?? "",
    fileName: audience?.config?.fileName,
  };
}

export function customValid(c: CustomConfig) {
  return c.name.trim().length > 0 && !!c.fileName;
}

export function CustomFields({
  config,
  onChange,
  editing = false,
}: {
  config: CustomConfig;
  onChange: (c: CustomConfig) => void;
  editing?: boolean;
}) {
  const t = useT();
  const set = <K extends keyof CustomConfig>(k: K, v: CustomConfig[K]) =>
    onChange({ ...config, [k]: v });

  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = (file: File) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError(t("Le fichier dépasse 10 Mo. Veuillez choisir une liste plus petite.", "File is over 10MB. Please choose a smaller list."));
      return;
    }
    if (!/\.csv$/i.test(file.name)) {
      setError(t("Seuls les fichiers .csv sont acceptés.", "Only .csv files are accepted."));
      return;
    }
    onChange({ ...config, fileName: file.name, fileSize: file.size });
  };

  const renderFile = () =>
    config.fileName ? (
      <div className="flex items-center gap-3 rounded-md border-hair border-hair bg-canvas p-2">
        <FileIcon />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-ink">{config.fileName}</div>
          {typeof config.fileSize === "number" && (
            <div className="text-2xs text-muted">{(config.fileSize / 1024).toFixed(0)} KB</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...config, fileName: undefined, fileSize: undefined })}
          aria-label={t("Supprimer le fichier", "Remove file")}
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-hair hover:text-ink"
        >
          ✕
        </button>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-2xs font-medium text-muted">{t("Nom de l'audience", "Audience name")}</label>
        <input
          value={config.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. OCC past patients"
          className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>

      <div>
        <label className="text-2xs font-medium text-muted">{t("Description de la source", "Source description")}</label>
        <input
          value={config.source}
          onChange={(e) => set("source", e.target.value)}
          placeholder="e.g. Past OCC patients — bariatric program"
          className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
        />
        <div className="mt-1 text-2xs text-muted">
          {t("Note interne pour vous rappeler l'origine de cette liste.", "Internal note so you remember where this list came from.")}
        </div>
      </div>

      <div>
        <div className="text-2xs font-medium text-muted">
          {editing && config.fileName
            ? t("Liste de clients", "Customer list")
            : t("Télécharger votre liste de clients", "Upload your customer list")}
        </div>
        <div className="mt-1">
          {config.fileName ? renderFile() : null}
          {editing && config.fileName ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-2 rounded-md border-hair border-hair bg-card px-3 py-1.5 text-xs text-ink hover:bg-canvas"
            >
              {t("Mettre à jour la liste", "Re-upload list")}
            </button>
          ) : (
            !config.fileName && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) accept(f);
                }}
                className={`flex w-full flex-col items-center justify-center rounded-md border border-dashed px-3 py-5 text-center transition-colors ${
                  dragOver ? "border-ai-text bg-ai-textbg" : "border-hair bg-canvas/60 hover:bg-canvas"
                }`}
              >
                <UploadIcon />
                <span className="text-xs text-ink">{t("Glissez-déposez votre CSV ici, ou cliquez pour parcourir", "Drag & drop your CSV here, or click to browse")}</span>
                <span className="text-2xs text-muted">{t("CSV uniquement · jusqu'à 10 Mo", "CSV only · up to 10MB")}</span>
              </button>
            )
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) accept(f);
              e.target.value = "";
            }}
          />
          {error && <div className="mt-1 text-2xs text-red-600">{error}</div>}
        </div>
        <div className="mt-1 text-2xs text-muted">
          {t(
            "CSV avec une colonne : e-mail ou numéro de téléphone. Nous n'envoyons jamais votre fichier — Meta le hache de votre côté.",
            "CSV with one column: email or phone number. We never send your file anywhere — Meta hashes it on your side."
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Lookalike audience config
// ────────────────────────────────────────────────────────────────────────────
export interface LookalikeConfig {
  name: string;
  sourceAudienceId: string;
  similarity: number;
  countries: string[];
}

export function makeLookalikeConfig(audience?: Audience): LookalikeConfig {
  const pct = parseInt(audience?.config?.similarity?.match(/(\d+)/)?.[1] ?? "1", 10);
  return {
    name: audience?.name ?? "",
    sourceAudienceId: audience?.config?.sourceAudienceId ?? "",
    similarity: pct,
    countries: audience?.config?.countries ?? [],
  };
}

export function lookalikeValid(c: LookalikeConfig) {
  return c.name.trim().length > 0 && !!c.sourceAudienceId && c.countries.length > 0;
}

export function estimateLookalikeReach(c: LookalikeConfig) {
  const base = 12_000 * c.similarity; // 1% ≈ 12K, 10% ≈ 120K
  const multiplier = Math.max(1, c.countries.length);
  return Math.round(base * multiplier);
}

export function LookalikeFields({
  config,
  onChange,
  sourceOptions,
}: {
  config: LookalikeConfig;
  onChange: (c: LookalikeConfig) => void;
  sourceOptions: Audience[];
}) {
  const t = useT();
  const set = <K extends keyof LookalikeConfig>(k: K, v: LookalikeConfig[K]) =>
    onChange({ ...config, [k]: v });

  const disabled = sourceOptions.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-2xs font-medium text-muted">{t("Nom de l'audience", "Audience name")}</label>
        <input
          value={config.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Lookalike — OCC patients (1%)"
          className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>

      <div>
        <label className="text-2xs font-medium text-muted">{t("Audience source", "Source audience")}</label>
        <select
          disabled={disabled}
          value={config.sourceAudienceId}
          onChange={(e) => set("sourceAudienceId", e.target.value)}
          className={`mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none ${
            disabled ? "cursor-not-allowed opacity-60" : ""
          }`}
        >
          <option value="">{t("Sélectionner une audience source…", "Select a source audience…")}</option>
          {sourceOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.type === "custom" ? t("Personnalisée", "Custom") : t("Enregistrée", "Saved")}
            </option>
          ))}
        </select>
        {disabled && (
          <div className="mt-1 text-2xs text-muted">{t("Créez d'abord une audience personnalisée.", "Create a Custom audience first.")}</div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-2xs font-medium text-muted">{t("Similarité", "Similarity")}</label>
          <span className="text-2xs font-medium text-ink">{config.similarity}%</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={config.similarity}
          onChange={(e) => set("similarity", Number(e.target.value))}
          className="mt-1 w-full accent-page"
        />
        <div className="flex justify-between text-2xs text-muted">
          <span>{t("Plus similaire (petite)", "Most similar (small)")}</span>
          <span>{t("Portée plus large (grande)", "Broader reach (large)")}</span>
        </div>
      </div>

      <div>
        <div className="text-2xs font-medium text-muted">{t("Pays", "Countries")}</div>
        <div className="mt-1">
          <SuggestingTagInput
            tags={config.countries}
            onChange={(v) => set("countries", v)}
            suggestions={LOCATION_SUGGESTIONS}
            placeholder={t("Ajouter un pays…", "Add a country…")}
          />
        </div>
        <div className="mt-1 text-2xs text-muted">
          {t("Les sosies trouvent des personnes similaires dans les pays que vous choisissez.", "Lookalikes find similar people in the countries you choose.")}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Estimator panel (used by Saved and Lookalike right columns)
// ────────────────────────────────────────────────────────────────────────────
function formatReach(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return `${n}`;
}

export function ReachEstimator({
  reach,
  label = "people in this audience",
  trailing,
}: {
  reach: number;
  label?: string;
  trailing?: string;
}) {
  const t = useT();
  // Zone:
  // < 10K too narrow; 10K-50K narrow; 50K-500K good; 500K-1M broad; > 1M too broad.
  let zone: "narrow" | "good" | "broad" = "good";
  if (reach < 10_000) zone = "narrow";
  else if (reach > 1_000_000) zone = "broad";

  // Position 0..1 along the bar
  const minLog = Math.log10(1_000);
  const maxLog = Math.log10(5_000_000);
  const pos = Math.min(1, Math.max(0, (Math.log10(Math.max(1, reach)) - minLog) / (maxLog - minLog)));

  const low = Math.round(reach * 0.9);
  const high = Math.round(reach * 1.1);

  return (
    <div className="space-y-4">
      <div>
        <div className="section-label">{t("Portée estimée", "Estimated reach")}</div>
        <div className="mt-1 text-xl font-semibold text-ink">
          {formatReach(low)} – {formatReach(high)}
        </div>
        <div className="text-2xs text-muted">{label}</div>
      </div>
      <div>
        <div className="section-label mb-1">{t("Taille de l'audience", "Audience size")}</div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-hair">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pos * 100}%`,
              backgroundColor:
                zone === "narrow" ? "#dc2626" : zone === "broad" ? "#d97706" : "#16a34a",
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-2xs">
          <span className={zone === "narrow" ? "font-medium text-red-600" : "text-muted"}>{t("Trop étroite", "Too narrow")}</span>
          <span className={zone === "good" ? "font-medium text-green-600" : "text-muted"}>{t("Bonne", "Good")}</span>
          <span className={zone === "broad" ? "font-medium text-amber-600" : "text-muted"}>{t("Trop large", "Too broad")}</span>
        </div>
      </div>
      {trailing && <div className="text-2xs text-muted">{trailing}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tag input with a typeahead pulled from a fixed suggestions list
// ────────────────────────────────────────────────────────────────────────────
function SuggestingTagInput({
  tags,
  onChange,
  suggestions,
  placeholder,
}: {
  tags: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const match = suggestions
    .filter((s) => !tags.includes(s) && s.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border-hair border-hair bg-card p-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded bg-canvas px-1.5 py-0.5 text-2xs text-ink"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== tag))}
              aria-label={`Remove ${tag}`}
              className="text-muted hover:text-ink"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              e.preventDefault();
              if (!tags.includes(query.trim())) onChange([...tags, query.trim()]);
              setQuery("");
            } else if (e.key === "Backspace" && !query && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          placeholder={tags.length ? "" : placeholder}
          className="min-w-[120px] flex-1 bg-transparent text-xs text-ink placeholder:text-muted focus:outline-none"
        />
      </div>
      {focused && query && match.length > 0 && (
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border-hair border-hair bg-card py-1 shadow-lg">
          {match.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange([...tags, s]);
                setQuery("");
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-ink hover:bg-canvas"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mb-1 text-muted">
      <path d="M12 16V4m0 0L7 9m5-5l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-muted">
      <path d="M7 3h8l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 3v5h6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Conversion helpers — build the persisted Audience from a form config
// ────────────────────────────────────────────────────────────────────────────
export function savedToAudience(c: SavedConfig, id: string): Audience {
  const reachNum = estimateSavedReach(c);
  const low = Math.round(reachNum * 0.9);
  const high = Math.round(reachNum * 1.1);
  const reach = `${formatReach(low)}-${formatReach(high)}`;
  return {
    id,
    type: "saved",
    name: c.name.trim(),
    description: `${c.gender} · ${c.ageMin}-${c.ageMax} · ${c.locations.join(", ") || "—"}`,
    detail: c.interests.length ? `Interests: ${c.interests.join(", ")}` : "Built from demographics",
    reach,
    created: "Created just now",
    inUse: 0,
    config: {
      gender: c.gender,
      ageRange: `${c.ageMin}-${c.ageMax}`,
      locations: c.locations,
      interests: c.interests,
    },
    lastSyncedAt: new Date().toISOString(),
    usedByAdSetIds: [],
    metaAudienceId: `act_${Math.floor(540000 + Math.random() * 100000)}`,
    createdAt: new Date().toISOString().slice(0, 10),
    createdBy: "Younes",
  };
}

export function customToAudience(c: CustomConfig, id: string): Audience {
  return {
    id,
    type: "custom",
    name: c.name.trim(),
    description: `Uploaded list · ${c.fileName ?? "list.csv"}`,
    detail: `Refreshed just now`,
    reach: "~1.2K",
    created: "Created just now",
    inUse: 0,
    config: {
      source: c.source.trim() || "Uploaded list",
      fileName: c.fileName,
      uploadDate: new Date().toISOString().slice(0, 10),
      matchRate: "Estimated ~83% match — Meta will hash on upload",
      refreshedAt: new Date().toISOString().slice(0, 10),
    },
    lastSyncedAt: new Date().toISOString(),
    usedByAdSetIds: [],
    metaAudienceId: `act_${Math.floor(540000 + Math.random() * 100000)}`,
    createdAt: new Date().toISOString().slice(0, 10),
    createdBy: "Younes",
  };
}

export function lookalikeToAudience(
  c: LookalikeConfig,
  id: string,
  sourceName: string
): Audience {
  const reachNum = estimateLookalikeReach(c);
  return {
    id,
    type: "lookalike",
    name: c.name.trim(),
    description: `${c.countries.join(", ") || "—"} · Top ${c.similarity}% similarity`,
    detail: `Based on ${sourceName}`,
    reach: `~${formatReach(reachNum)}`,
    created: "Created just now",
    inUse: 0,
    config: {
      sourceAudienceId: c.sourceAudienceId,
      sourceAudienceName: sourceName,
      similarity: `Top ${c.similarity}%`,
      countries: c.countries,
    },
    lastSyncedAt: new Date().toISOString(),
    usedByAdSetIds: [],
    metaAudienceId: `act_${Math.floor(540000 + Math.random() * 100000)}`,
    createdAt: new Date().toISOString().slice(0, 10),
    createdBy: "Younes",
  };
}

// Keep React happy with effect deps when types are inferred.
export function useNoop() { useEffect(() => {}, []); }
