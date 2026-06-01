"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { addAudience } from "@/lib/audience-store";
import { useCompany } from "@/lib/company-context";
import {
  CustomFields,
  LookalikeFields,
  ReachEstimator,
  SavedFields,
  customToAudience,
  customValid,
  estimateLookalikeReach,
  estimateSavedReach,
  lookalikeToAudience,
  lookalikeValid,
  makeCustomConfig,
  makeLookalikeConfig,
  makeSavedConfig,
  savedToAudience,
  savedValid,
  type CustomConfig,
  type LookalikeConfig,
  type SavedConfig,
} from "./audience-form";
import type { Audience, AudienceType } from "@/lib/types";

const TYPE_BADGE_STYLE: Record<AudienceType, { bg: string; text: string }> = {
  saved: { bg: "bg-ai-textbg", text: "text-ai-text" },
  custom: { bg: "bg-ai-visualbg", text: "text-ai-visual" },
  lookalike: { bg: "bg-amber-50", text: "text-amber-700" },
};

const TYPE_LABEL: Record<AudienceType, string> = {
  saved: "Saved",
  custom: "Custom",
  lookalike: "Lookalike",
};

const SUBSTEP_LABEL: Record<AudienceType, string> = {
  saved: "Step 2 of 2 — Define targeting",
  custom: "Step 2 of 2 — Upload your list",
  lookalike: "Step 2 of 2 — Configure your lookalike",
};

export function NewAudienceModal({
  companyId,
  onClose,
  onCreated,
}: {
  companyId: string;
  onClose: () => void;
  onCreated: (audience: Audience) => void;
}) {
  const { data } = useCompany();
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<AudienceType>("saved");
  const [savedConfig, setSavedConfig] = useState<SavedConfig>(makeSavedConfig());
  const [customConfig, setCustomConfig] = useState<CustomConfig>(makeCustomConfig());
  const [lookConfig, setLookConfig] = useState<LookalikeConfig>(makeLookalikeConfig());

  const hasCustom = data.audiences.list.some((a) => a.type === "custom");

  const lookalikeSourceOptions = useMemo(
    () => data.audiences.list.filter((a) => a.type === "custom" || a.type === "saved"),
    [data.audiences.list]
  );

  const choose = (t: AudienceType) => {
    setType(t);
    setStep(2);
  };

  const canSubmit =
    type === "saved"
      ? savedValid(savedConfig)
      : type === "custom"
      ? customValid(customConfig)
      : lookalikeValid(lookConfig);

  const submit = () => {
    let audience: Audience;
    const id = `aud-${Date.now()}`;
    if (type === "saved") audience = savedToAudience(savedConfig, id);
    else if (type === "custom") audience = customToAudience(customConfig, id);
    else {
      const src = data.audiences.list.find((a) => a.id === lookConfig.sourceAudienceId);
      audience = lookalikeToAudience(lookConfig, id, src?.name ?? "Source audience");
    }
    addAudience(companyId, audience);
    onCreated(audience);
    onClose();
  };

  const stepHeader =
    step === 1 ? (
      <div className="border-b-hair border-hair px-4 py-3">
        <div className="text-sm font-semibold text-ink">New audience</div>
        <div className="text-2xs text-muted">Step 1 of 2 — Choose audience type</div>
      </div>
    ) : (
      <div className="flex items-center justify-between gap-2 border-b-hair border-hair px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep(1)}
            aria-label="Back"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
          >
            ←
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              New audience
              <span
                className={`rounded px-1.5 py-0.5 text-2xs font-medium ${TYPE_BADGE_STYLE[type].bg} ${TYPE_BADGE_STYLE[type].text}`}
              >
                {TYPE_LABEL[type]}
              </span>
            </div>
            <div className="text-2xs text-muted">{SUBSTEP_LABEL[type]}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
        >
          ✕
        </button>
      </div>
    );

  return (
    <Modal open onClose={onClose} width={step === 1 ? "max-w-xl" : "max-w-3xl"}>
      {stepHeader}

      {step === 1 ? (
        <div className="px-4 py-3">
          <p className="mb-3 text-sm text-muted">
            Audiences define who sees your ads. Pick the type that matches how you want to target.
          </p>
          <div className="space-y-2">
            <TypeCard
              type="saved"
              title="Saved audience"
              badge="Most common"
              description="Target by demographics and interests — gender, age, location, hobbies. Start here if you don't have a customer list yet."
              example="Example: Women 35-55 in Mauritius interested in wellness"
              icon={<TargetIcon />}
              onClick={() => choose("saved")}
            />
            <TypeCard
              type="custom"
              title="Custom audience"
              description="Upload a list of your existing customers (emails or phone numbers). Meta will match them to their accounts."
              example="Example: All past OCC patients — re-engagement campaign"
              icon={<UsersIcon />}
              onClick={() => choose("custom")}
            />
            <TypeCard
              type="lookalike"
              title="Lookalike audience"
              description="Find new people similar to your existing customers. Requires a Custom audience first."
              example="Example: People like our top patients — broaden reach"
              icon={<AffiliateIcon />}
              disabled={!hasCustom}
              disabledTooltip="Create a Custom audience first to build a Lookalike."
              onClick={() => choose("lookalike")}
            />
          </div>
          <div className="mt-4 flex justify-end border-t-hair border-hair pt-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Step2
          type={type}
          savedConfig={savedConfig}
          setSavedConfig={setSavedConfig}
          customConfig={customConfig}
          setCustomConfig={setCustomConfig}
          lookConfig={lookConfig}
          setLookConfig={setLookConfig}
          lookalikeSourceOptions={lookalikeSourceOptions}
          onBack={() => setStep(1)}
          onCancel={onClose}
          onSubmit={submit}
          canSubmit={canSubmit}
        />
      )}
    </Modal>
  );
}

function TypeCard({
  type,
  title,
  description,
  example,
  badge,
  icon,
  disabled,
  disabledTooltip,
  onClick,
}: {
  type: AudienceType;
  title: string;
  description: string;
  example: string;
  badge?: string;
  icon: React.ReactNode;
  disabled?: boolean;
  disabledTooltip?: string;
  onClick: () => void;
}) {
  const style = TYPE_BADGE_STYLE[type];
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? disabledTooltip : undefined}
      className={`flex w-full items-start gap-3 rounded-md border-hair border-hair bg-card p-3 text-left transition-colors ${
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-canvas"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${style.bg} ${style.text}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{title}</span>
          {badge && (
            <span className={`rounded px-1.5 py-0.5 text-2xs font-medium ${style.bg} ${style.text}`}>
              {badge}
            </span>
          )}
        </div>
        <div className="text-2xs text-muted">{description}</div>
        <div className="mt-1.5 text-2xs text-muted">
          <span className="font-medium text-ink/80">Example:</span> {example.replace(/^Example:\s*/, "")}
        </div>
      </div>
      <span className="mt-1 shrink-0 text-muted">›</span>
    </button>
  );
}

function Step2({
  type,
  savedConfig,
  setSavedConfig,
  customConfig,
  setCustomConfig,
  lookConfig,
  setLookConfig,
  lookalikeSourceOptions,
  onBack,
  onCancel,
  onSubmit,
  canSubmit,
}: {
  type: AudienceType;
  savedConfig: SavedConfig;
  setSavedConfig: (c: SavedConfig) => void;
  customConfig: CustomConfig;
  setCustomConfig: (c: CustomConfig) => void;
  lookConfig: LookalikeConfig;
  setLookConfig: (c: LookalikeConfig) => void;
  lookalikeSourceOptions: Audience[];
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  const requiredHint =
    type === "saved"
      ? "Fill required fields to continue."
      : type === "custom"
      ? "Add a name and upload a CSV to continue."
      : "Add a name, source audience, and at least one country to continue.";

  return (
    <>
      <div className="grid max-h-[70vh] grid-cols-[1fr_280px] overflow-hidden">
        <div className="overflow-y-auto p-4">
          {type === "saved" && (
            <SavedFields config={savedConfig} onChange={setSavedConfig} />
          )}
          {type === "custom" && (
            <CustomFields config={customConfig} onChange={setCustomConfig} />
          )}
          {type === "lookalike" && (
            <LookalikeFields
              config={lookConfig}
              onChange={setLookConfig}
              sourceOptions={lookalikeSourceOptions}
            />
          )}
        </div>

        {/* Right column — info / estimator */}
        <div className="overflow-y-auto border-l-hair border-hair bg-canvas/40 p-4">
          {type === "saved" && (
            <ReachEstimator
              reach={estimateSavedReach(savedConfig)}
              label="people in this audience"
              trailing="Reach is estimated by Meta and updates as you change targeting."
            />
          )}
          {type === "custom" && (
            <CustomInfoPanel
              hasFile={!!customConfig.fileName}
              fileName={customConfig.fileName}
              fileSize={customConfig.fileSize}
            />
          )}
          {type === "lookalike" && (
            <ReachEstimator
              reach={estimateLookalikeReach(lookConfig)}
              label="similar people on Meta"
              trailing="Lookalikes broaden reach beyond your existing customers."
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onBack}>← Back</Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            title={canSubmit ? undefined : requiredHint}
            onClick={onSubmit}
          >
            Create audience
          </Button>
        </div>
      </div>
    </>
  );
}

function CustomInfoPanel({
  hasFile,
  fileName,
  fileSize,
}: {
  hasFile: boolean;
  fileName?: string;
  fileSize?: number;
}) {
  if (!hasFile) {
    return (
      <div className="space-y-3">
        <div className="section-label">Audience size</div>
        <div className="text-sm text-muted">Upload a file to see size.</div>
        <div className="text-2xs text-muted">
          Your CSV is hashed locally before being sent to Meta — we never see or store raw emails or phone numbers.
        </div>
      </div>
    );
  }
  // Mock detection — assume ~50 rows per KB.
  const detected = Math.max(50, Math.round(((fileSize ?? 25_000) / 1024) * 50));
  const matched = Math.round(detected * 0.83);
  return (
    <div className="space-y-4">
      <div>
        <div className="section-label">Audience size</div>
        <div className="mt-1 text-xl font-semibold text-ink">
          ~{detected.toLocaleString()} rows detected
        </div>
        <div className="text-2xs text-muted">in {fileName}</div>
      </div>
      <div>
        <div className="section-label">Estimated Meta match</div>
        <div className="mt-1 text-sm text-ink">
          ~{matched.toLocaleString()} of {detected.toLocaleString()} will match · 83%
        </div>
      </div>
      <div className="text-2xs text-muted">
        Meta hashes your file on your side before matching. Raw values never leave your browser.
      </div>
    </div>
  );
}

function TargetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3 19c1.5-3 4-4 6-4s4.5 1 6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 19c1-2 2.5-3 4-3s3 1 3 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function AffiliateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="6" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M8 8l3 8M16 8l-3 8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
