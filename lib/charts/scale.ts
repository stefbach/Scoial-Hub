/**
 * Échelles et graduations des graphiques.
 *
 * Isolé du composant de rendu : ce sont les seules parties dont la justesse
 * se démontre, et elles se testent sans navigateur.
 */

/**
 * Arrondi « lisible » vers le haut : 47 → 50, 230 → 250, 1 320 → 1 500.
 * Un axe gradué 0 / 26 / 52 se lit moins bien qu'un axe 0 / 25 / 50.
 */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = Math.pow(10, exponent);
  const n = value / base;
  const step = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * base;
}

/**
 * Indices régulièrement espacés à afficher en abscisse, bornes incluses.
 * Jamais plus de `count` graduations : au-delà, les libellés se chevauchent.
 */
export function tickIndexes(length: number, count = 5): number[] {
  if (length <= 0) return [];
  if (length <= count) return Array.from({ length }, (_, i) => i);
  return Array.from({ length: count }, (_, k) =>
    Math.round((k * (length - 1)) / (count - 1))
  );
}
