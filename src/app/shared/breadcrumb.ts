import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { NodeStore } from '../core/node-store';

/** Hjem › Kælder › Reol 2 › Kasse 1 – every level is a link. Scrolls to show the end. */
@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink, MatIcon],
  template: `
    <nav aria-label="Placering" #scroller>
      <ol>
        <li>
          <a routerLink="/" class="home" aria-label="Hjem" title="Hjem">
            <mat-icon svgIcon="home" aria-hidden="true" />
          </a>
        </li>
        @for (ancestor of ancestors(); track ancestor.id) {
          <li>
            <span class="sep" aria-hidden="true">›</span>
            <a [routerLink]="['/n', ancestor.id]">{{ ancestor.name }}</a>
          </li>
        }
        @if (node(); as current) {
          <li>
            <span class="sep" aria-hidden="true">›</span>
            <span class="current" aria-current="page">{{ current.name }}</span>
          </li>
        }
      </ol>
    </nav>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    nav {
      overflow-x: auto;
      scrollbar-width: none;
    }
    nav::-webkit-scrollbar {
      display: none;
    }
    ol {
      display: flex;
      align-items: center;
      margin: 0;
      padding: 0;
      list-style: none;
      white-space: nowrap;
      font: var(--mat-sys-title-small);
    }
    li {
      display: flex;
      align-items: center;
    }
    a {
      display: inline-flex;
      align-items: center;
      min-height: 40px;
      padding: 0 6px;
      border-radius: 8px;
      color: var(--mat-sys-primary);
      text-decoration: none;
    }
    a:hover {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }
    a.home {
      padding: 0 8px;
    }
    .sep {
      color: var(--mat-sys-on-surface-variant);
      padding: 0 2px;
    }
    .current {
      padding: 0 6px;
      color: var(--mat-sys-on-surface);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Breadcrumb {
  readonly nodeId = input.required<string>();

  private readonly store = inject(NodeStore);
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  protected readonly node = computed(() => this.store.get(this.nodeId()));
  protected readonly ancestors = computed(() => this.store.ancestors(this.nodeId()));

  constructor() {
    afterRenderEffect(() => {
      this.ancestors();
      const el = this.scroller().nativeElement;
      el.scrollLeft = el.scrollWidth;
    });
  }
}
