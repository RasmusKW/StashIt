/**
 * Parser for the quick-add field.
 *
 * Every non-empty line becomes one node. Within a line:
 *  - `#word` becomes a tag (lower-cased). It must contain at least one letter, so
 *    "Kasse #1" keeps "#1" in the name.
 *  - A standalone word that is a plain number with an `x` before or after it ("x200", "200x",
 *    also "X200" and "200×") becomes the quantity. Words like "4x40" stay in the name.
 *    If there are several, the last one is the quantity and the others stay in the name.
 *  - Everything else (in original order and casing) is the name.
 *  - A leading list bullet ("- ", "* ", "• ") from pasted lists is ignored.
 *
 * Lines that end up without a name (empty, or only tags/quantity) are skipped.
 */

export interface ParsedLine {
  name: string;
  tags: string[];
  quantity?: number;
}

const QUANTITY = /^(?:[x×](\d{1,9})|(\d{1,9})[x×])$/i;
const BULLET = /^\s*(?:[-*•–]|\[[ xX]?\])\s+/;
const HAS_LETTER = /\p{L}/u;

/** Splits a `#tag` token into tags, or returns null if the token is not a tag. */
function parseTagToken(token: string): string[] | null {
  if (!token.startsWith('#')) return null;
  const parts = token
    .split('#')
    .map((part) => part.replace(/[.,;:!?]+$/, '').toLowerCase())
    .filter((part) => part.length > 0);
  if (parts.length === 0 || !parts.every((part) => HAS_LETTER.test(part))) return null;
  return parts;
}

/** Parses a single line. The returned name may be empty. */
export function parseQuickAddLine(line: string): ParsedLine {
  const tokens = line.replace(BULLET, '').trim().split(/\s+/).filter(Boolean);
  const tags: string[] = [];
  const kept: string[] = [];

  let quantityIndex = -1;
  let quantity: number | undefined;
  tokens.forEach((token, index) => {
    const match = QUANTITY.exec(token);
    if (match) {
      quantityIndex = index;
      quantity = Number(match[1] ?? match[2]);
    }
  });

  tokens.forEach((token, index) => {
    if (index === quantityIndex) return;
    const tokenTags = parseTagToken(token);
    if (tokenTags) {
      for (const tag of tokenTags) if (!tags.includes(tag)) tags.push(tag);
      return;
    }
    kept.push(token);
  });

  const result: ParsedLine = { name: kept.join(' '), tags };
  if (quantity !== undefined) result.quantity = quantity;
  return result;
}

/** Parses the whole input (one node per line); lines without a name are dropped. */
export function parseQuickAdd(text: string): ParsedLine[] {
  return text
    .split(/\r\n|\r|\n/)
    .map(parseQuickAddLine)
    .filter((line) => line.name.length > 0);
}

/**
 * Finds the `#partial` tag being typed at the caret, for tag autocompletion.
 * Returns the partial tag (without `#`) and where it starts, or null.
 */
export function tagAtCaret(
  text: string,
  caret: number,
): { partial: string; start: number; end: number } | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)#([^\s#]*)$/u.exec(before);
  if (!match) return null;
  const start = caret - match[2].length - 1;
  const afterMatch = /^[^\s]*/.exec(text.slice(caret));
  const end = caret + (afterMatch ? afterMatch[0].length : 0);
  return { partial: match[2].toLowerCase(), start, end };
}
