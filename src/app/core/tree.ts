/**
 * Pure tree helpers over a map of nodes. They never trust the data blindly: every upward walk
 * is guarded against cycles so corrupted data cannot hang the app.
 */
import { ItemNode } from './models';

export type NodeLookup = Pick<ReadonlyMap<string, ItemNode>, 'get'>;

/** Ancestors of a node from the top level down to its parent (the node itself excluded). */
export function ancestorsOf(nodes: NodeLookup, id: string): ItemNode[] {
  const result: ItemNode[] = [];
  const seen = new Set<string>([id]);
  let parentId = nodes.get(id)?.parentId ?? null;
  while (parentId !== null && !seen.has(parentId)) {
    const parent = nodes.get(parentId);
    if (!parent) break;
    seen.add(parentId);
    result.unshift(parent);
    parentId = parent.parentId;
  }
  return result;
}

/** True if `id` is `ancestorId` itself or lies somewhere below it. */
export function isSelfOrDescendant(nodes: NodeLookup, id: string, ancestorId: string): boolean {
  const seen = new Set<string>();
  let current: string | null = id;
  while (current !== null && !seen.has(current)) {
    if (current === ancestorId) return true;
    seen.add(current);
    current = nodes.get(current)?.parentId ?? null;
  }
  return false;
}

/**
 * Whether all `ids` may be moved into `targetId` (`null` = top level). A node can never be
 * moved into itself or into any of its descendants, and the target must exist.
 */
export function canMoveTo(
  nodes: NodeLookup,
  ids: readonly string[],
  targetId: string | null,
): boolean {
  if (targetId === null) return true;
  if (!nodes.get(targetId)) return false;
  return ids.every((id) => !isSelfOrDescendant(nodes, targetId, id));
}

/** All ids in the subtrees rooted at `rootIds` (roots included), parents before children. */
export function collectSubtree(
  childrenOf: (id: string) => readonly ItemNode[],
  rootIds: readonly string[],
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const stack = [...rootIds].reverse();
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    const children = childrenOf(id);
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i].id);
  }
  return result;
}

/** Removes ids whose ancestor is also in the list (moving/deleting the ancestor covers them). */
export function topmostOnly(nodes: NodeLookup, ids: readonly string[]): string[] {
  const set = new Set(ids);
  return ids.filter((id) => !ancestorsOf(nodes, id).some((ancestor) => set.has(ancestor.id)));
}
