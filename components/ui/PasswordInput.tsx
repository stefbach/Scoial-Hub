"use client";

import { useId, useState } from "react";

/**
 * Password input with a built-in show/hide eye toggle. Pure presentational
 * component — caller owns the value state. Falls back gracefully when label
 * is omitted (e.g. when used inside another labeled wrapper).
 */
export function PasswordInput({
  label,
  value,
  onChange,
  required,
  autoComplete,
  placeholder,
  helper,
  invalid,
  id: idProp,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  helper?: React.ReactNode;
  invalid?: boolean;
  id?: string;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [visible, setVisible] = useState(false);
  const ringClass = invalid
    ? "focus:ring-red-300 border-red-200"
    : "focus:ring-ai-text/40 border-hair";

  return (
    <div>
      {label && (
        <label htmlFor={id} className="text-2xs font-medium text-muted">
          {label}
        </label>
      )}
      <div className={`relative ${label ? "mt-1" : ""}`}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`w-full rounded-md border-hair bg-card px-3 py-2 pr-10 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 ${ringClass}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink focus:outline-none focus:ring-1 focus:ring-ai-text/40"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {helper && <div className="mt-1 text-2xs text-muted">{helper}</div>}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 10 6 10 6a18.4 18.4 0 0 1-3.2 4.1M6.4 7.6A18.4 18.4 0 0 0 2 12s3.5 6 10 6c1.6 0 3.1-.4 4.4-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 9.5a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
