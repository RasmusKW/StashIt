import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ItemNode } from '../core/models';
import { NodeRow } from './node-row';

/** Lists longer than this use virtual scrolling. */
export const VIRTUAL_SCROLL_THRESHOLD = 60;

/** A list of node rows; switches to window-based virtual scrolling for long lists. */
@Component({
  selector: 'app-node-list',
  imports: [ScrollingModule, NodeRow],
  template: `
    @if (virtual()) {
      <cdk-virtual-scroll-viewport
        scrollWindow
        [itemSize]="rowHeight()"
        [minBufferPx]="rowHeight() * 10"
        [maxBufferPx]="rowHeight() * 20"
        role="list"
        [attr.aria-label]="label()"
      >
        <div *cdkVirtualFor="let node of nodes(); trackBy: trackById" role="listitem">
          <app-node-row [node]="node" [showPath]="showPath()" [selectable]="selectable()" />
        </div>
      </cdk-virtual-scroll-viewport>
    } @else {
      <div role="list" [attr.aria-label]="label()">
        @for (node of nodes(); track node.id) {
          <div role="listitem">
            <app-node-row [node]="node" [showPath]="showPath()" [selectable]="selectable()" />
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  host: { '[style.--row-height.px]': 'rowHeight()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeList {
  readonly nodes = input.required<readonly ItemNode[]>();
  readonly showPath = input(false);
  readonly selectable = input(true);
  readonly label = input<string>();

  protected readonly rowHeight = computed(() => (this.showPath() ? 84 : 72));
  protected readonly virtual = computed(() => this.nodes().length > VIRTUAL_SCROLL_THRESHOLD);
  protected readonly trackById = (_: number, node: ItemNode) => node.id;
}
