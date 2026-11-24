import { makeNode } from '../../testing/factories';
import { ItemNode } from './models';
import { SearchEngine, SearchQuery, emptyQuery, isActiveQuery } from './search-engine';

/** A mutable in-memory source, like the NodeStore. */
class FakeSource {
  nodes = new Map<string, ItemNode>();
  photos = new Set<string>();
  get = (id: string) => this.nodes.get(id);
  all = () => this.nodes.values();
  hasPhoto = (id: string) => this.photos.has(id);
  add(...nodes: ItemNode[]) {
    for (const node of nodes) this.nodes.set(node.id, node);
  }
}

function q(text: string, extra: Partial<SearchQuery> = {}): SearchQuery {
  return { ...emptyQuery(), text, ...extra };
}

describe('SearchEngine', () => {
  let source: FakeSource;
  let engine: SearchEngine;
  const names = (query: SearchQuery) => engine.search(query).map((hit) => hit.node.name);

  beforeEach(() => {
    source = new FakeSource();
    source.add(
      makeNode({ id: 'kaelder', name: 'Kælder' }),
      makeNode({ id: 'reol1', name: 'Reol 1', parentId: 'kaelder' }),
      makeNode({ id: 'reol2', name: 'Reol 2', parentId: 'kaelder' }),
      makeNode({ id: 'reol20', name: 'Reol 20', parentId: 'kaelder' }),
      makeNode({ id: 'kasse1', name: 'Kasse 1', parentId: 'reol2' }),
      makeNode({ id: 'kasse2', name: 'Kasse 2', parentId: 'reol1' }),
      makeNode({ id: 'skruer', name: 'Skruer 4x40', parentId: 'kasse1', quantity: 200 }),
      makeNode({ id: 'trækker', name: 'Skruetrækker', parentId: 'kasse1', tags: ['værktøj'] }),
      makeNode({
        id: 'tang',
        name: 'Spidstang',
        parentId: 'reol2',
        tags: ['værktøj', 'tang'],
        favorite: true,
      }),
      makeNode({
        id: 'boremaskine',
        name: 'Boremaskine',
        parentId: 'kasse2',
        notes: 'Bosch, lånt af Ole',
      }),
      makeNode({ id: 'pensel', name: 'Pensel', parentId: 'reol20' }),
      makeNode({ id: 'loft', name: 'Loft' }),
      makeNode({ id: 'jul', name: 'Julepynt', parentId: 'loft', tags: ['jul'] }),
    );
    engine = new SearchEngine(source);
  });

  it('finds items despite typos (fuzzy)', () => {
    expect(names(q('skrutrækker'))[0]).toBe('Skruetrækker');
    expect(names(q('boremaskne'))).toContain('Boremaskine');
  });

  it('matches prefixes while typing', () => {
    expect(names(q('spids'))).toEqual(['Spidstang']);
    expect(names(q('skru'))).toEqual(expect.arrayContaining(['Skruer 4x40', 'Skruetrækker']));
  });

  it('is case-insensitive and treats æ/ae, ø/oe, å/aa alike', () => {
    expect(names(q('KAELDER'))[0]).toBe('Kælder');
    expect(names(q('kælder'))[0]).toBe('Kælder');
    expect(names(q('vaerktoej'))).toEqual(expect.arrayContaining(['Spidstang', 'Skruetrækker']));
    expect(names(q('SKRUETRAEKKER'))[0]).toBe('Skruetrækker');
  });

  it('searches tags and notes', () => {
    expect(names(q('værktøj')).sort()).toEqual(['Skruetrækker', 'Spidstang']);
    expect(names(q('#jul'))).toEqual(['Julepynt']);
    expect(names(q('ole'))).toEqual(['Boremaskine']);
  });

  it('searches the path: "reol 2" shows everything under Reol 2, best matches first', () => {
    const result = names(q('reol 2'));
    expect(result[0]).toBe('Reol 2');
    expect(result.slice(1, 5).sort()).toEqual([
      'Kasse 1',
      'Skruer 4x40',
      'Skruetrækker',
      'Spidstang',
    ]);
    expect(result).not.toContain('Pensel'); // in Reol 20
    expect(result).not.toContain('Reol 20');
  });

  it('requires all words to match', () => {
    expect(names(q('skruer kasse 1'))).toEqual(['Skruer 4x40']);
    expect(names(q('skruer loft'))).toEqual([]);
  });

  it('keeps "4x40" searchable as one word', () => {
    expect(names(q('4x40'))).toEqual(['Skruer 4x40']);
  });

  it('limits results to a subtree (excluding the scope node itself)', () => {
    // Kasse 1 first; its contents match through their path. Kasse 2 (in Reol 1) is out of scope.
    expect(names(q('kasse', { scopeId: 'reol2' }))[0]).toBe('Kasse 1');
    expect(names(q('kasse', { scopeId: 'reol2' })).sort()).toEqual([
      'Kasse 1',
      'Skruer 4x40',
      'Skruetrækker',
    ]);
    expect(names(q('reol', { scopeId: 'reol2' })).sort()).toEqual([
      'Kasse 1',
      'Skruer 4x40',
      'Skruetrækker',
      'Spidstang',
    ]);
    expect(names(q('kasse')).slice(0, 2).sort()).toEqual(['Kasse 1', 'Kasse 2']);
  });

  describe('filters', () => {
    it('filter by tags (all selected tags required)', () => {
      expect(names(q('', { tags: ['værktøj'] }))).toEqual(['Skruetrækker', 'Spidstang']);
      expect(names(q('', { tags: ['værktøj', 'tang'] }))).toEqual(['Spidstang']);
    });

    it('filter by favorites and photos, also without text', () => {
      source.photos.add('jul');
      expect(names(q('', { favoritesOnly: true }))).toEqual(['Spidstang']);
      expect(names(q('', { withPhoto: true }))).toEqual(['Julepynt']);
      expect(names(q('jul', { withPhoto: true }))).toEqual(['Julepynt']);
      expect(names(q('spids', { withPhoto: true }))).toEqual([]);
    });

    it('combines filters with scope; no text and no filters gives nothing', () => {
      expect(names(q('', { tags: ['værktøj'], scopeId: 'kasse1' }))).toEqual(['Skruetrækker']);
      expect(names(q('   '))).toEqual([]);
      expect(isActiveQuery(q(' '))).toBe(false);
      expect(isActiveQuery(q('', { withPhoto: true }))).toBe(true);
    });
  });

  describe('incremental updates', () => {
    it('picks up new, changed and deleted nodes', () => {
      expect(names(q('hammer'))).toEqual([]);
      source.add(makeNode({ id: 'hammer', name: 'Hammer', parentId: 'loft' }));
      engine.markDirty(['hammer']);
      expect(names(q('hammer'))).toEqual(['Hammer']);

      source.add({ ...source.nodes.get('hammer')!, name: 'Kløfthammer' });
      engine.markDirty(['hammer']);
      expect(names(q('kløft'))).toEqual(['Kløfthammer']);

      source.nodes.delete('hammer');
      engine.markDirty(['hammer']);
      expect(names(q('hammer'))).toEqual([]);
    });

    it('updates paths when an ancestor is renamed or a node moves', () => {
      source.add({ ...source.nodes.get('reol2')!, name: 'Hylde' });
      engine.markDirty(['reol2', 'kasse1', 'skruer', 'trækker', 'tang']);
      expect(names(q('hylde'))).toContain('Spidstang');

      source.add({ ...source.nodes.get('tang')!, parentId: 'loft' });
      engine.markDirty(['tang']);
      expect(names(q('loft'))).toContain('Spidstang');
      expect(names(q('hylde'))).not.toContain('Spidstang');
    });

    it('rebuilds everything after reset', () => {
      source.nodes.clear();
      engine.reset();
      expect(names(q('kasse'))).toEqual([]);
    });
  });

  it('stays fast with 5 000 nodes', () => {
    const big = new FakeSource();
    const words = [
      'Skruer',
      'Søm',
      'Kabel',
      'Lampe',
      'Bog',
      'Tøj',
      'Værktøj',
      'Legetøj',
      'Pære',
      'Tape',
    ];
    for (let room = 0; room < 10; room++) {
      big.add(makeNode({ id: `r${room}`, name: `Rum ${room}` }));
      for (let box = 0; box < 49; box++) {
        const boxId = `r${room}b${box}`;
        big.add(makeNode({ id: boxId, name: `Kasse ${box}`, parentId: `r${room}` }));
        for (let item = 0; item < 9; item++) {
          big.add(
            makeNode({
              id: `${boxId}i${item}`,
              name: `${words[(room + box + item) % words.length]} ${item}`,
              parentId: boxId,
              tags: [words[item % words.length].toLowerCase()],
            }),
          );
        }
      }
    }
    expect(big.nodes.size).toBe(10 + 490 + 4410);
    const bigEngine = new SearchEngine(big);

    let start = performance.now();
    bigEngine.search(q('kabel')); // builds the index
    const buildMs = performance.now() - start;

    const queries = ['værktøj', 'vaerktoej', 'skrutr', 'kasse 12', 'lmpe', 'rum 3 kasse 7', 'p'];
    start = performance.now();
    for (const text of queries) bigEngine.search(q(text));
    const perSearchMs = (performance.now() - start) / queries.length;

    expect(bigEngine.search(q('rum 3 kasse 7')).length).toBeGreaterThan(5);
    expect(buildMs).toBeLessThan(3000);
    expect(perSearchMs).toBeLessThan(150);
  });
});
