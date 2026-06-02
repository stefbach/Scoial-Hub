export function eur(value: number, opts: { decimals?: boolean } = {}) {
  const fixed = opts.decimals
    ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value.toLocaleString("en-US");
  return `EUR ${fixed}`;
}

export function pct(value: number) {
  return `${value}%`;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function groupDateLabel(iso: string) {
  // Robuste aux dates absentes/invalides (ex : brouillons sans date d'un agent)
  if (!iso) return "SANS DATE";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "SANS DATE";
  return `${DAYS[d.getDay()].toUpperCase()}, ${d.getDate()} ${MONTHS[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
}
