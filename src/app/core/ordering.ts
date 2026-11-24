import { ItemNode } from './models';

/** Containers (nodes with contents) first, then loose items; each group keeps its order. */
export function containersFirst(
  nodes: readonly ItemNode[],
  childCount: (id: string) => number,
): ItemNode[] {
  const containers: ItemNode[] = [];
  const items: ItemNode[] = [];
  for (const node of nodes) (childCount(node.id) > 0 ? containers : items).push(node);
  return [...containers, ...items];
}
