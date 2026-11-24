import { fitWithin, extensionFor } from './image-compress';
import { newId } from './models';
import { formatBytes } from './storage.service';

describe('image sizing', () => {
  it('scales the longest side down to the limit and never up', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1200, 300)).toEqual({ width: 300, height: 225 });
    expect(fitWithin(10000, 1, 300)).toEqual({ width: 300, height: 1 });
  });

  it('maps image types to file extensions', () => {
    expect(extensionFor('image/webp')).toBe('webp');
    expect(extensionFor('image/jpeg')).toBe('jpg');
  });
});

describe('ids and formatting', () => {
  it('creates unique v4 uuids', () => {
    const ids = new Set(Array.from({ length: 100 }, newId));
    expect(ids.size).toBe(100);
    expect([...ids][0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('formats bytes in Danish', () => {
    expect(formatBytes(null)).toBe('ukendt');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(12_345_678)).toBe('12,3 MB');
  });
});
