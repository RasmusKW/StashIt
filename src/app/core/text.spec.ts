import { formatQuantity, mergeTags, naturalCompare, normalizeDa, normalizeTag, plural } from './text';

describe('normalizeDa (Danish normalization)', () => {
  it('is case-insensitive', () => {
    expect(normalizeDa('SKRUER')).toBe('skruer');
    expect(normalizeDa('Kælder')).toBe(normalizeDa('KÆLDER'));
  });

  it('makes æ/ae, ø/oe and å/aa match each other', () => {
    expect(normalizeDa('Kælder')).toBe(normalizeDa('kaelder'));
    expect(normalizeDa('Værktøj')).toBe(normalizeDa('vaerktoej'));
    expect(normalizeDa('Skåle')).toBe(normalizeDa('skaale'));
    expect(normalizeDa('ÆØÅ')).toBe('aeoeaa');
  });

  it('strips other diacritics', () => {
    expect(normalizeDa('Café crème')).toBe('cafe creme');
    expect(normalizeDa('Säng')).toBe('saeng');
  });

  it('leaves plain text, digits and punctuation alone', () => {
    expect(normalizeDa('Reol 2 – 4x40')).toBe('reol 2 – 4x40');
  });
});

describe('naturalCompare', () => {
  it('sorts numbers naturally', () => {
    const names = ['Kasse 10', 'Kasse 2', 'Kasse 1', 'kasse 3'];
    expect(names.sort(naturalCompare)).toEqual(['Kasse 1', 'Kasse 2', 'kasse 3', 'Kasse 10']);
  });

  it('sorts æ, ø, å after z (Danish alphabet)', () => {
    expect(['Åben', 'Zebra', 'Øl', 'Æble', 'Abe'].sort(naturalCompare)).toEqual([
      'Abe',
      'Zebra',
      'Æble',
      'Øl',
      'Åben',
    ]);
  });
});

describe('tags', () => {
  it('normalizes typed tags', () => {
    expect(normalizeTag('#Værktøj')).toBe('værktøj');
    expect(normalizeTag('  El Ting ')).toBe('el-ting');
    expect(normalizeTag('tang,')).toBe('tang');
    expect(normalizeTag('#')).toBe('');
  });

  it('merges without duplicates', () => {
    expect(mergeTags(['a', 'b'], ['B', 'c', '#a', ''])).toEqual(['a', 'b', 'c']);
  });
});

describe('formatting', () => {
  it('formats quantities and plurals in Danish', () => {
    expect(formatQuantity(undefined)).toBe('');
    expect(formatQuantity(1200)).toBe('1.200 stk.');
    expect(plural(1, 'billede', 'billeder')).toBe('1 billede');
    expect(plural(3, 'billede', 'billeder')).toBe('3 billeder');
  });
});
