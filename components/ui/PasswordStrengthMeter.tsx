"use client";

import {
  STRENGTH_COLOR,
  STRENGTH_LABEL,
  STRENGTH_PCT,
  passwordStrength,
} from "@/lib/password-strength";

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = passwordStrength(password);
  if (strength === "empty") return null;
  return (
    <div className="mt-1">
      <div className="h-1 w-full overflow-hidden rounded-full bg-hair">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${STRENGTH_PCT[strength]}%`,
            backgroundColor: STRENGTH_COLOR[strength],
          }}
        />
      </div>
      <div className="mt-1 text-2xs" style={{ color: STRENGTH_COLOR[strength] }}>
        {STRENGTH_LABEL[strength]}
      </div>
    </div>
  );
}
