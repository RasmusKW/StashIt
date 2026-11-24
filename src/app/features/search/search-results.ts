import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { NodeStore } from '../../core/node-store';
import { plural } from '../../core/text';
import { NodeList } from '../../shared/node-list';
import { SearchController } from './search-controller';

/** Results with thumbnail, name, tags and full path, so you see where things are. */
@Component({
  selector: 'app-search-results',
  imports: [MatButton, NodeList],
  template: `
    <p class="summary" role="status">
      {{ summary() }}
    </p>
    @if (ctrl.results().length) {
      <app-node-list [nodes]="ctrl.results()" [showPath]="true" label="Søgeresultater" />
    } @else if (ctrl.isScoped() && !ctrl.everywhere()) {
      <button matButton="tonal" type="button" (click)="ctrl.setEverywhere(true)">
        Søg overalt
      </button>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .summary {
      margin: 12px 4px 4px;
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResults {
  protected readonly ctrl = inject(SearchController);
  private readonly store = inject(NodeStore);

  protected readonly summary = computed(() => {
    const count = this.ctrl.results().length;
    const scope = this.store.get(this.ctrl.scope());
    const where = scope ? ` i «${scope.name}»` : '';
    if (count === 0) return `Intet fundet${where}`;
    return `${plural(count, 'resultat', 'resultater')}${where}`;
  });
}
