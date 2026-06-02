// Cheap-and-cheerful password strength heuristic. Used purely as UX guidance —
// the hard rule (8-character minimum) is enforced separately.

export type PasswordStrength = "empty" | "weak" | "fair" | "strong";

export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return "empty";
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return "weak";
  if (score <= 3) return "fair";
  return "strong";
}

export const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  empty: "",
  weak: "Weak",
  fair: "Fair",
  strong: "Strong",
};

export const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  empty: "transparent",
  weak: "#dc2626",
  fair: "#d97706",
  strong: "#16a34a",
};

export const STRENGTH_PCT: Record<PasswordStrength, number> = {
  empty: 0,
  weak: 33,
  fair: 66,
  strong: 100,
};
