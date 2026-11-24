import { ItemNode } from '../app/core/models';

let counter = 0;

/** Creates a node for tests. `id` defaults to a readable unique id. */
export function makeNode(partial: Partial<ItemNode> & { name: string }): ItemNode {
  counter++;
  return {
    id: partial.id ?? `n${counter}`,
    parentId: null,
    tags: [],
    favorite: false,
    createdAt: 1_700_000_000_000 + counter,
    updatedAt: 1_700_000_000_000 + counter,
    ...partial,
  };
}

/** Builds a Map from a list of nodes. */
export function nodeMap(nodes: ItemNode[]): Map<string, ItemNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}
