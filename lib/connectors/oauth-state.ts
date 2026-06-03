// Encode/décode le state OAuth pour transporter companyId + URL de retour.
import crypto from "crypto";

export function buildState(companyId: string, ret: string): string {
  return `${crypto.randomBytes(8).toString("hex")}.${encodeURIComponent(companyId)}.${encodeURIComponent(ret)}`;
}

export function parseState(state: string | null): { companyId: string; ret: string } {
  const parts = (state ?? "").split(".");
  return {
    companyId: parts[1] ? decodeURIComponent(parts[1]) : "",
    ret: parts[2] ? decodeURIComponent(parts[2]) : "/parametres-connecteurs",
  };
}
