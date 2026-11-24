import { makeNode } from '../../testing/factories';
import { containersFirst } from './ordering';

describe('containersFirst', () => {
  it('puts nodes with contents first and keeps the natural order within groups', () => {
    const nodes = ['Hammer', 'Kasse 2', 'Kasse 10', 'Søm'].map((name) => makeNode({ id: name, name }));
    const counts: Record<string, number> = { 'Kasse 2': 3, 'Kasse 10': 1 };
    expect(containersFirst(nodes, (id) => counts[id] ?? 0).map((n) => n.name)).toEqual([
      'Kasse 2',
      'Kasse 10',
      'Hammer',
      'Søm',
    ]);
  });
});
