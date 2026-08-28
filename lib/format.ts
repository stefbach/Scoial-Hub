export function eur(value: number, opts: { decimals?: boolean } = {}) {
  const fixed = opts.decimals
    ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value.toLocaleString("en-US");
  return `EUR ${fixed}`;
}

export function pct(value: number) {
  return `${value}%`;
}

/**
 * Formate un montant exprimé en unités MINEURES entières (centimes). La monnaie
 * n'est jamais manipulée en flottant : la partie entière et les centimes sont
 * séparés par division entière, le point décimal n'apparaît qu'à l'affichage.
 */
export function moneyFromCents(cents: number, currency = "EUR") {
  const n = Math.trunc(cents);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const units = Math.trunc(abs / 100);
  const rest = abs % 100;
  return `${sign}${currency} ${units.toLocaleString("en-US")}.${String(rest).padStart(2, "0")}`;
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
