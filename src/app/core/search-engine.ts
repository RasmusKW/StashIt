import MiniSearch from 'minisearch';
import { ItemNode } from './models';
import { naturalCompare, normalizeDa } from './text';

/** What the engine needs to know about the data (kept abstract for testing). */
export interface SearchSource {
  get(id: string): ItemNode | undefined;
  all(): Iterable<ItemNode>;
  hasPhoto(id: string): boolean;
}

export interface SearchQuery {
  text: string;
  /** Limit to the subtree below this node (the node itself excluded); null = everywhere. */
  scopeId: string | null;
  /** Node must have all of these tags. */
  tags: readonly string[];
  favoritesOnly: boolean;
  withPhoto: boolean;
}

export interface SearchHit {
  node: ItemNode;
  score: number;
}

interface IndexedDoc {
  id: string;
  name: string;
  tags: string;
  notes: string;
  path: string;
}

interface Normalized {
  name: string;
  /** Path and name as normalized words: "kaelder reol 2 kasse 1 skruer" */
  full: string;
}

export function emptyQuery(scopeId: string | null = null): SearchQuery {
  return { text: '', scopeId, tags: [], favoritesOnly: false, withPhoto: false };
}

/** True if the query has text or any filter set. */
export function isActiveQuery(query: SearchQuery): boolean {
  return (
    query.text.trim().length > 0 || query.tags.length > 0 || query.favoritesOnly || query.withPhoto
  );
}

function processTerm(term: string): string | null {
  const normalized = normalizeDa(term);
  return normalized.length > 0 ? normalized : null;
}

/** Normalized words joined by single spaces. */
function words(text: string): string {
  return normalizeDa(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .join(' ');
}

function createIndex(): MiniSearch<IndexedDoc> {
  return new MiniSearch<IndexedDoc>({
    fields: ['name', 'tags', 'notes', 'path'],
    storeFields: [],
    processTerm,
    searchOptions: {
      boost: { name: 3, tags: 2, path: 1, notes: 1 },
      // Typo tolerance for words of 4+ letters ("skrutrækker" → "Skruetrækker").
      fuzzy: (term) => (term.length >= 4 ? 0.2 : false),
      // Prefix matching ("spids" → "Spidstang"), but numbers must match exactly so that
      // "reol 2" does not also match "Reol 20".
      prefix: (term) => !/^\d+$/.test(term),
      combineWith: 'AND',
      processTerm,
    },
  });
}

/**
 * Full-text search over nodes: name, tags, notes and path (the names of all ancestors, so
 * "reol 2" finds everything inside Reol 2). Fuzzy + prefix matching with Danish normalization.
 *
 * The index is updated incrementally: callers mark changed ids dirty and the engine applies
 * the changes lazily right before the next search.
 */
export class SearchEngine {
  private index = createIndex();
  private readonly normalized = new Map<string, Normalized>();
  private readonly dirty = new Set<string>();
  private needsRebuild = true;

  constructor(private readonly source: SearchSource) {}

  /** Forget everything; the index is rebuilt before the next search. */
  reset(): void {
    this.needsRebuild = true;
    this.dirty.clear();
  }

  /** Mark nodes as changed (created, edited, moved, deleted). */
  markDirty(ids: Iterable<string>): void {
    if (this.needsRebuild) return;
    for (const id of ids) this.dirty.add(id);
  }

  search(query: SearchQuery): SearchHit[] {
    this.flush();
    const text = query.text.trim();
    const matches = (node: ItemNode) => this.passesFilters(node, query);

    if (!words(text)) {
      if (!isActiveQuery(query)) return [];
      const hits: SearchHit[] = [];
      for (const node of this.source.all()) if (matches(node)) hits.push({ node, score: 0 });
      return hits.sort(
        (a, b) =>
          naturalCompare(a.node.name, b.node.name) ||
          naturalCompare(this.norm(a.node).full, this.norm(b.node).full),
      );
    }

    const phrase = words(text);
    const ranked: { hit: SearchHit; tier: number }[] = [];
    for (const result of this.index.search(text)) {
      const node = this.source.get(result.id as string);
      if (!node || !matches(node)) continue;
      ranked.push({ hit: { node, score: result.score }, tier: this.tier(node, phrase) });
    }
    ranked.sort((a, b) => b.tier - a.tier || b.hit.score - a.hit.score);
    return ranked.map((r) => r.hit);
  }

  /** Higher tier = closer to what was typed; within a tier MiniSearch's score decides. */
  private tier(node: ItemNode, phrase: string): number {
    const { name, full } = this.norm(node);
    if (name === phrase) return 4;
    if (name.startsWith(phrase)) return 3;
    if (` ${name}`.includes(` ${phrase}`)) return 2;
    if (` ${full} `.includes(` ${phrase} `)) return 1;
    return 0;
  }

  private passesFilters(node: ItemNode, query: SearchQuery): boolean {
    if (query.favoritesOnly && !node.favorite) return false;
    if (query.withPhoto && !this.source.hasPhoto(node.id)) return false;
    for (const tag of query.tags) if (!node.tags.includes(tag)) return false;
    if (query.scopeId !== null && !this.isInside(node, query.scopeId)) return false;
    return true;
  }

  private isInside(node: ItemNode, ancestorId: string): boolean {
    const seen = new Set<string>();
    let parentId = node.parentId;
    while (parentId !== null && !seen.has(parentId)) {
      if (parentId === ancestorId) return true;
      seen.add(parentId);
      parentId = this.source.get(parentId)?.parentId ?? null;
    }
    return false;
  }

  private pathNames(node: ItemNode): string[] {
    const names: string[] = [];
    const seen = new Set<string>([node.id]);
    let parentId = node.parentId;
    while (parentId !== null && !seen.has(parentId)) {
      const parent = this.source.get(parentId);
      if (!parent) break;
      seen.add(parentId);
      names.unshift(parent.name);
      parentId = parent.parentId;
    }
    return names;
  }

  private toDoc(node: ItemNode): IndexedDoc {
    const path = this.pathNames(node).join(' ');
    this.normalized.set(node.id, { name: words(node.name), full: words(`${path} ${node.name}`) });
    return {
      id: node.id,
      name: node.name,
      tags: node.tags.join(' '),
      notes: node.notes ?? '',
      path,
    };
  }

  private norm(node: ItemNode): Normalized {
    let value = this.normalized.get(node.id);
    if (!value) {
      this.toDoc(node);
      value = this.normalized.get(node.id) as Normalized;
    }
    return value;
  }

  private flush(): void {
    if (this.needsRebuild) {
      this.index = createIndex();
      this.normalized.clear();
      this.index.addAll([...this.source.all()].map((node) => this.toDoc(node)));
      this.needsRebuild = false;
      this.dirty.clear();
      return;
    }
    if (this.dirty.size === 0) return;
    for (const id of this.dirty) {
      const node = this.source.get(id);
      const indexed = this.index.has(id);
      if (node) {
        const doc = this.toDoc(node);
        if (indexed) this.index.replace(doc);
        else this.index.add(doc);
      } else {
        if (indexed) this.index.discard(id);
        this.normalized.delete(id);
      }
    }
    this.dirty.clear();
  }
}
