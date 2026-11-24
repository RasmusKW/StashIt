import { makeNode, nodeMap } from '../../testing/factories';
import { ItemNode } from './models';
import { ancestorsOf, canMoveTo, collectSubtree, isSelfOrDescendant, topmostOnly } from './tree';

// Kælder › Reol 2 › Kasse 1 › Skruer
//                 › Spidstang
// Loft
const kaelder = makeNode({ id: 'kaelder', name: 'Kælder' });
const reol = makeNode({ id: 'reol', name: 'Reol 2', parentId: 'kaelder' });
const kasse = makeNode({ id: 'kasse', name: 'Kasse 1', parentId: 'reol' });
const skruer = makeNode({ id: 'skruer', name: 'Skruer', parentId: 'kasse' });
const tang = makeNode({ id: 'tang', name: 'Spidstang', parentId: 'reol' });
const loft = makeNode({ id: 'loft', name: 'Loft' });
const nodes = nodeMap([kaelder, reol, kasse, skruer, tang, loft]);

const childrenOf = (id: string): ItemNode[] =>
  [...nodes.values()].filter((node) => node.parentId === id);

describe('tree helpers', () => {
  it('lists ancestors from the top', () => {
    expect(ancestorsOf(nodes, 'skruer').map((n) => n.name)).toEqual(['Kælder', 'Reol 2', 'Kasse 1']);
    expect(ancestorsOf(nodes, 'kaelder')).toEqual([]);
    expect(ancestorsOf(nodes, 'missing')).toEqual([]);
  });

  it('detects descendants', () => {
    expect(isSelfOrDescendant(nodes, 'skruer', 'kaelder')).toBe(true);
    expect(isSelfOrDescendant(nodes, 'reol', 'reol')).toBe(true);
    expect(isSelfOrDescendant(nodes, 'loft', 'kaelder')).toBe(false);
    expect(isSelfOrDescendant(nodes, 'kaelder', 'skruer')).toBe(false);
  });

  describe('canMoveTo', () => {
    it('never allows moving a node into itself', () => {
      expect(canMoveTo(nodes, ['reol'], 'reol')).toBe(false);
    });

    it('never allows moving a node into one of its descendants', () => {
      expect(canMoveTo(nodes, ['reol'], 'kasse')).toBe(false);
      expect(canMoveTo(nodes, ['kaelder'], 'skruer')).toBe(false);
    });

    it('allows moving to siblings, other branches and the top level', () => {
      expect(canMoveTo(nodes, ['skruer'], 'reol')).toBe(true);
      expect(canMoveTo(nodes, ['kasse'], 'loft')).toBe(true);
      expect(canMoveTo(nodes, ['tang'], 'kasse')).toBe(true);
      expect(canMoveTo(nodes, ['kasse'], null)).toBe(true);
    });

    it('allows moving an item into a leaf (any node can contain nodes)', () => {
      expect(canMoveTo(nodes, ['tang'], 'skruer')).toBe(true);
    });

    it('rejects the whole selection if any node would end up inside itself', () => {
      expect(canMoveTo(nodes, ['loft', 'reol'], 'kasse')).toBe(false);
      expect(canMoveTo(nodes, ['loft', 'tang'], 'kasse')).toBe(true);
    });

    it('rejects unknown targets', () => {
      expect(canMoveTo(nodes, ['tang'], 'nope')).toBe(false);
    });

    it('does not hang on corrupted cyclic data', () => {
      const a = makeNode({ id: 'a', name: 'A', parentId: 'b' });
      const b = makeNode({ id: 'b', name: 'B', parentId: 'a' });
      const cyclic = nodeMap([a, b, loft]);
      expect(canMoveTo(cyclic, ['loft'], 'a')).toBe(true);
      expect(ancestorsOf(cyclic, 'a').map((n) => n.id)).toEqual(['b']);
    });
  });

  it('collects a subtree, parents first', () => {
    expect(collectSubtree(childrenOf, ['reol'])).toEqual(['reol', 'kasse', 'skruer', 'tang']);
    expect(collectSubtree(childrenOf, ['kasse', 'skruer'])).toEqual(['kasse', 'skruer']);
  });

  it('keeps only the topmost of nested selections', () => {
    expect(topmostOnly(nodes, ['skruer', 'reol', 'loft'])).toEqual(['reol', 'loft']);
  });
});
