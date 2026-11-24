import { parseQuickAdd, parseQuickAddLine, tagAtCaret } from './quick-add-parser';

describe('quick-add parser', () => {
  it('parses a plain name', () => {
    expect(parseQuickAddLine('Skruetrækker')).toEqual({ name: 'Skruetrækker', tags: [] });
  });

  it('turns #words into lower-case tags', () => {
    expect(parseQuickAddLine('Spidstang #værktøj #Tang')).toEqual({
      name: 'Spidstang',
      tags: ['værktøj', 'tang'],
    });
  });

  it('keeps "4x40" in the name and reads "x200" as quantity', () => {
    expect(parseQuickAddLine('Skruer 4x40 x200')).toEqual({
      name: 'Skruer 4x40',
      tags: [],
      quantity: 200,
    });
  });

  it('accepts the number before the x ("200x") and upper case / × variants', () => {
    expect(parseQuickAddLine('200x Søm')).toEqual({ name: 'Søm', tags: [], quantity: 200 });
    expect(parseQuickAddLine('Søm X12')).toEqual({ name: 'Søm', tags: [], quantity: 12 });
    expect(parseQuickAddLine('Søm 3×')).toEqual({ name: 'Søm', tags: [], quantity: 3 });
  });

  it('only treats standalone number+x words as quantity', () => {
    expect(parseQuickAddLine('Bræt 2x4 lang')).toEqual({ name: 'Bræt 2x4 lang', tags: [] });
    expect(parseQuickAddLine('Kasse x')).toEqual({ name: 'Kasse x', tags: [] });
    expect(parseQuickAddLine('Xbox 360')).toEqual({ name: 'Xbox 360', tags: [] });
    expect(parseQuickAddLine('Skruer x2a')).toEqual({ name: 'Skruer x2a', tags: [] });
  });

  it('uses the last quantity word and keeps earlier ones in the name', () => {
    expect(parseQuickAddLine('Pakke x2 x10')).toEqual({ name: 'Pakke x2', tags: [], quantity: 10 });
  });

  it('accepts quantity zero', () => {
    expect(parseQuickAddLine('Pærer x0')).toEqual({ name: 'Pærer', tags: [], quantity: 0 });
  });

  it('mixes tags and quantity anywhere in the line', () => {
    expect(parseQuickAddLine('#el Kabel x3 sort #ledning')).toEqual({
      name: 'Kabel sort',
      tags: ['el', 'ledning'],
      quantity: 3,
    });
  });

  it('keeps numeric hashes like "#1" in the name', () => {
    expect(parseQuickAddLine('Kasse #1')).toEqual({ name: 'Kasse #1', tags: [] });
    expect(parseQuickAddLine('Kasse # 1')).toEqual({ name: 'Kasse # 1', tags: [] });
  });

  it('splits glued tags and strips trailing punctuation', () => {
    expect(parseQuickAddLine('Tang #værktøj#have, #el.')).toEqual({
      name: 'Tang',
      tags: ['værktøj', 'have', 'el'],
    });
  });

  it('deduplicates tags', () => {
    expect(parseQuickAddLine('Tang #el #EL').tags).toEqual(['el']);
  });

  it('collapses whitespace and strips list bullets', () => {
    expect(parseQuickAddLine('  -   Hammer   stor ')).toEqual({ name: 'Hammer stor', tags: [] });
    expect(parseQuickAddLine('• Sav')).toEqual({ name: 'Sav', tags: [] });
    expect(parseQuickAddLine('[ ] Lim')).toEqual({ name: 'Lim', tags: [] });
    expect(parseQuickAddLine('-5 grader soveposer').name).toBe('-5 grader soveposer');
  });

  it('returns an empty name for lines with only tags or only a quantity', () => {
    expect(parseQuickAddLine('#værktøj #tang')).toEqual({ name: '', tags: ['værktøj', 'tang'] });
    expect(parseQuickAddLine('x200')).toEqual({ name: '', tags: [], quantity: 200 });
  });

  describe('multiple lines', () => {
    it('creates one entry per line and skips empty lines', () => {
      const result = parseQuickAdd('Hammer\n\n  \nSkruer 4x40 x200\r\nSøm #værktøj\rLim');
      expect(result.map((line) => line.name)).toEqual(['Hammer', 'Skruer 4x40', 'Søm', 'Lim']);
      expect(result[1].quantity).toBe(200);
      expect(result[2].tags).toEqual(['værktøj']);
    });

    it('skips lines with only tags', () => {
      expect(parseQuickAdd('#værktøj\nTang #værktøj\n#el #kabel')).toEqual([
        { name: 'Tang', tags: ['værktøj'] },
      ]);
    });

    it('returns nothing for empty input', () => {
      expect(parseQuickAdd('')).toEqual([]);
      expect(parseQuickAdd('\n \n\t')).toEqual([]);
    });
  });

  describe('tagAtCaret', () => {
    it('finds the tag being typed', () => {
      expect(tagAtCaret('Tang #væ', 8)).toEqual({ partial: 'væ', start: 5, end: 8 });
      expect(tagAtCaret('#', 1)).toEqual({ partial: '', start: 0, end: 1 });
    });

    it('covers the rest of the word after the caret', () => {
      expect(tagAtCaret('Tang #værk x2', 8)).toEqual({ partial: 'væ', start: 5, end: 10 });
    });

    it('ignores # inside words and finished tags', () => {
      expect(tagAtCaret('C#', 2)).toBeNull();
      expect(tagAtCaret('Tang #el ', 9)).toBeNull();
      expect(tagAtCaret('Tang', 4)).toBeNull();
    });
  });
});
