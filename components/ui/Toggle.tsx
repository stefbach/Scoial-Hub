"use client";

import { useState } from "react";

export function Toggle({
  defaultOn = false,
  onChange,
  disabled = false,
}: {
  defaultOn?: boolean;
  onChange?: (on: boolean) => void;
  disabled?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setOn((v) => {
          onChange?.(!v);
          return !v;
        });
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "bg-page" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          on ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
