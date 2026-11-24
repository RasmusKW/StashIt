import {
  ChangeDetectionStrategy,
  Component,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MetaStore } from '../core/meta-store';
import { ItemNode } from '../core/models';
import { NodeStore } from '../core/node-store';
import { emptyQuery } from '../core/search-engine';
import { SearchService } from '../core/search.service';
import { plural } from '../core/text';

export interface MoveSheetData {
  ids: readonly string[];
}

export interface MoveSheetResult {
  /** `null` = top level. */
  targetId: string | null;
}

type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'top'; key: string }
  | {
      kind: 'node';
      key: string;
      node: ItemNode;
      depth: number;
      path: string;
      expandable: boolean;
      expanded: boolean;
    };

const ROW_HEIGHT = 52;

/**
 * "Flyt til…": search, favorites and recently used locations at the top, the whole tree
 * below (virtual scrolling). The selected nodes and everything inside them are disabled.
 */
@Component({
  selector: 'app-move-sheet',
  imports: [ScrollingModule, MatIconButton, MatIcon],
  templateUrl: './move-sheet.html',
  styleUrl: './move-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveSheet {
  protected readonly data = inject<MoveSheetData>(MAT_BOTTOM_SHEET_DATA);
  private readonly ref = inject<MatBottomSheetRef<MoveSheet, MoveSheetResult>>(MatBottomSheetRef);
  private readonly store = inject(NodeStore);
  private readonly meta = inject(MetaStore);
  private readonly search = inject(SearchService);
  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  protected readonly rowHeight = ROW_HEIGHT;
  protected readonly query = signal('');
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected readonly title = computed(() => {
    const ids = this.data.ids;
    const first = this.store.get(ids[0]);
    return ids.length === 1 && first
      ? `Flyt «${first.name}» til…`
      : `Flyt ${plural(ids.length, 'ting', 'ting')} til…`;
  });

  /** The moved nodes and all their descendants – never valid targets. */
  private readonly invalid = computed(() => new Set(this.store.subtreeIds(this.data.ids)));

  /** The common current location, if all moved nodes share it. */
  private readonly currentParent = computed<string | null | undefined>(() => {
    const parents = new Set(this.data.ids.map((id) => this.store.get(id)?.parentId ?? null));
    return parents.size === 1 ? [...parents][0] : undefined;
  });

  protected readonly rows = computed<Row[]>(() => {
    const text = this.query().trim();
    const rows: Row[] = [];
    const nodeRow = (node: ItemNode, section: string, depth = 0, withPath = true): Row => {
      const expandable = this.store.childCount(node.id) > 0;
      return {
        kind: 'node',
        key: `${section}:${node.id}`,
        node,
        depth,
        path: withPath ? this.store.locationText(node.id) || 'Øverste niveau' : '',
        expandable,
        expanded: expandable && this.expanded().has(node.id),
      };
    };

    if (text) {
      const hits = this.search.search({ ...emptyQuery(), text }).slice(0, 200);
      for (const hit of hits) rows.push(nodeRow(hit.node, 'result'));
      return rows;
    }

    rows.push({ kind: 'top', key: 'top' });

    const favorites = this.store.favorites();
    if (favorites.length) {
      rows.push({ kind: 'header', key: 'h:fav', label: 'Favoritter' });
      for (const node of favorites) rows.push(nodeRow(node, 'fav'));
    }

    const recent = this.meta
      .recentTargets()
      .map((id) => this.store.get(id))
      .filter((node): node is ItemNode => node !== undefined);
    if (recent.length) {
      rows.push({ kind: 'header', key: 'h:recent', label: 'Senest brugt' });
      for (const node of recent) rows.push(nodeRow(node, 'recent'));
    }

    rows.push({ kind: 'header', key: 'h:all', label: 'Alle steder' });
    const visit = (parentId: string | null, depth: number) => {
      for (const node of this.store.children(parentId)) {
        const row = nodeRow(node, 'tree', depth, false);
        rows.push(row);
        if (row.kind === 'node' && row.expanded) visit(node.id, depth + 1);
      }
    };
    visit(null, 0);
    return rows;
  });

  protected readonly viewportHeight = computed(() =>
    Math.max(
      ROW_HEIGHT * 2,
      Math.min(this.rows().length * ROW_HEIGHT, Math.round(window.innerHeight * 0.6)),
    ),
  );

  constructor() {
    afterRenderEffect(() => {
      this.viewportHeight();
      this.viewport()?.checkViewportSize();
    });
  }

  protected isDisabled(id: string | null): boolean {
    if (id === null) return this.currentParent() === null;
    return this.invalid().has(id) || this.currentParent() === id;
  }

  protected disabledReason(id: string | null): string {
    if (id !== null && this.invalid().has(id)) return 'kan ikke flyttes ind i sig selv';
    return 'nuværende placering';
  }

  protected toggle(id: string): void {
    const next = new Set(this.expanded());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expanded.set(next);
  }

  protected choose(id: string | null): void {
    if (this.isDisabled(id)) return;
    this.ref.dismiss({ targetId: id });
  }

  protected close(): void {
    this.ref.dismiss();
  }

  protected trackRow = (_: number, row: Row) => row.key;
}
