/**
 * "Next free number" suggestions: when the user types "Kasse" and the app already has
 * "Kasse 1" and "Kasse 2" (anywhere), suggest "Kasse 3".
 *
 * The next number is one higher than the highest existing number, so a number is never reused
 * even if a box in the middle was deleted (its label may still be on a physical box).
 */
import { normalizeDa } from './text';

const NUMBERED = /^(.*\S)\s+(\d{1,9})$/u;

export interface NumberedName {
  prefix: string;
  number: number;
}

/** Splits "Kasse 12" into { prefix: "Kasse", number: 12 }; null if not numbered. */
export function splitNumbered(name: string): NumberedName | null {
  const match = NUMBERED.exec(name.trim());
  return match ? { prefix: match[1], number: Number(match[2]) } : null;
}

export interface NumberIndexEntry {
  /** The prefix as written on the highest-numbered node (keeps the user's casing). */
  prefix: string;
  max: number;
}

/** Normalized prefix → highest number in use. */
export type NumberIndex = ReadonlyMap<string, NumberIndexEntry>;

export function buildNumberIndex(names: Iterable<string>): NumberIndex {
  const index = new Map<string, NumberIndexEntry>();
  for (const name of names) {
    const numbered = splitNumbered(name);
    if (!numbered) continue;
    const key = normalizeDa(numbered.prefix);
    const current = index.get(key);
    if (!current || numbered.number > current.max) {
      index.set(key, { prefix: numbered.prefix, max: numbered.number });
    }
  }
  return index;
}

/**
 * The suggestion for what the user has typed (already stripped of tags/quantity), or null.
 * Nothing is suggested if the typed name already ends with a number.
 */
export function suggestNextName(index: NumberIndex, typedName: string): string | null {
  const typed = typedName.trim();
  if (!typed || splitNumbered(typed)) return null;
  const entry = index.get(normalizeDa(typed));
  return entry ? `${entry.prefix} ${entry.max + 1}` : null;
}
