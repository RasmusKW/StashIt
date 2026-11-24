/**
 * Text helpers: Danish-aware normalization for search/matching, natural sorting and tags.
 */

/**
 * Normalizes text for matching: lower case, Danish letters spelled out (æ→ae, ø→oe, å→aa, so
 * "kælder" and "kaelder" match each other), other diacritics removed ("é" → "e").
 */
export function normalizeDa(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ|ä/g, 'ae')
    .replace(/ø|ö/g, 'oe')
    .replace(/å/g, 'aa')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

const collator = new Intl.Collator('da', { numeric: true, sensitivity: 'base' });

/** Natural, Danish-aware comparison: "Kasse 2" < "Kasse 10", æ/ø/å sorted last. */
export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b);
}

/**
 * Normalizes a tag typed by the user: strips leading `#`, trims, lower-cases and replaces
 * whitespace with `-` (tags are single words so they work in the quick-add syntax).
 * Returns an empty string for something that is not a usable tag.
 */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/[.,;:!?]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/** Adds tags to a list without duplicates, keeping the original order. */
export function mergeTags(existing: readonly string[], added: readonly string[]): string[] {
  const result = [...existing];
  for (const tag of added) {
    const clean = normalizeTag(tag);
    if (clean && !result.includes(clean)) result.push(clean);
  }
  return result;
}

/** Formats a quantity for display, e.g. "200 stk." */
export function formatQuantity(quantity: number | undefined): string {
  return quantity === undefined ? '' : `${quantity.toLocaleString('da-DK')} stk.`;
}

/** Danish plural helper: plural(1, 'ting', 'ting'), plural(2, 'billede', 'billeder'). */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count.toLocaleString('da-DK')} ${count === 1 ? singular : pluralForm}`;
}
