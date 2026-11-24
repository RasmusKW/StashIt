import { buildNumberIndex, splitNumbered, suggestNextName } from './numbering';

describe('next free number', () => {
  it('splits numbered names', () => {
    expect(splitNumbered('Kasse 12')).toEqual({ prefix: 'Kasse', number: 12 });
    expect(splitNumbered('Reol  B 3')).toEqual({ prefix: 'Reol  B', number: 3 });
    expect(splitNumbered('Kasse')).toBeNull();
    expect(splitNumbered('Kasse12')).toBeNull();
    expect(splitNumbered('4x40')).toBeNull();
  });

  it('suggests the next number after "Kasse 1" and "Kasse 2"', () => {
    const index = buildNumberIndex(['Kasse 1', 'Kasse 2', 'Hammer']);
    expect(suggestNextName(index, 'Kasse')).toBe('Kasse 3');
  });

  it('is case-insensitive and Danish-normalized, keeping the existing casing', () => {
    const index = buildNumberIndex(['Flyttekasse 4', 'Skab Ø 1']);
    expect(suggestNextName(index, 'flyttekasse')).toBe('Flyttekasse 5');
    expect(suggestNextName(index, 'skab oe')).toBe('Skab Ø 2');
  });

  it('uses the highest number, never reusing gaps', () => {
    const index = buildNumberIndex(['Kasse 1', 'Kasse 7', 'Kasse 3', 'Kasse 10']);
    expect(suggestNextName(index, 'Kasse')).toBe('Kasse 11');
  });

  it('suggests nothing for unknown words, numbered input or empty input', () => {
    const index = buildNumberIndex(['Kasse 1']);
    expect(suggestNextName(index, 'Pose')).toBeNull();
    expect(suggestNextName(index, 'Kasse 5')).toBeNull();
    expect(suggestNextName(index, '  ')).toBeNull();
  });

  it('works for multi-word prefixes and ignores surrounding whitespace', () => {
    const index = buildNumberIndex(['Kasse jul 1', 'Kasse jul 2', 'Kasse 9']);
    expect(suggestNextName(index, ' Kasse jul ')).toBe('Kasse jul 3');
    expect(suggestNextName(index, 'Kasse')).toBe('Kasse 10');
  });
});
