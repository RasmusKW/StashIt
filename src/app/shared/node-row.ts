import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { LocationStrategy } from '@angular/common';
import { Router } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { ItemNode } from '../core/models';
import { NodeStore } from '../core/node-store';
import { SelectionService } from '../core/selection.service';
import { formatQuantity } from '../core/text';
import { LongPressDirective } from './long-press.directive';
import { Thumb } from './thumb';

/**
 * One node in a list: thumbnail, name, quantity, tags, optional path and content count.
 * A real link (works with middle-click / new tab). A long press (or right-click) starts
 * multi-select; while selecting, a tap toggles selection instead of navigating.
 */
@Component({
  selector: 'app-node-row',
  imports: [MatIcon, Thumb, LongPressDirective],
  templateUrl: './node-row.html',
  styleUrl: './node-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeRow {
  readonly node = input.required<ItemNode>();
  /** Show where the node is ("Kælder › Reol 2"). */
  readonly showPath = input(false);
  readonly selectable = input(true);

  private readonly store = inject(NodeStore);
  private readonly selection = inject(SelectionService);
  private readonly router = inject(Router);
  private readonly locationStrategy = inject(LocationStrategy);
  private readonly longPress = viewChild.required(LongPressDirective);

  protected readonly count = computed(() => this.store.childCount(this.node().id));
  protected readonly location = computed(() =>
    this.showPath() ? this.store.locationText(this.node().id) : '',
  );
  protected readonly quantity = computed(() => formatQuantity(this.node().quantity));
  protected readonly tagsText = computed(() =>
    this.node()
      .tags.map((tag) => `#${tag}`)
      .join(' '),
  );
  protected readonly selecting = computed(() => this.selectable() && this.selection.active());
  protected readonly selected = computed(() => this.selection.isSelected(this.node().id));
  protected readonly href = computed(() =>
    this.locationStrategy.prepareExternalUrl(`/n/${this.node().id}`),
  );

  protected onClick(event: MouseEvent): void {
    if (this.longPress().consumeClick()) {
      event.preventDefault();
      return;
    }
    // Let the browser handle "open in new tab" etc.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (this.selecting()) {
      this.selection.toggle(this.node().id);
    } else {
      void this.router.navigate(['/n', this.node().id]);
    }
  }

  protected onLongPress(): void {
    if (!this.selectable()) return;
    this.selection.toggle(this.node().id);
  }
}
