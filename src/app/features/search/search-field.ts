import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatChipListbox, MatChipOption, MatChipSelectionChange } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';
import { SearchController } from './search-controller';

/** Search input at the top of a page plus the filter chips below it. */
@Component({
  selector: 'app-search-field',
  imports: [MatIconButton, MatIcon, MatChipListbox, MatChipOption],
  template: `
    <div class="field" role="search">
      <mat-icon svgIcon="search" aria-hidden="true" />
      <input
        #input
        id="search-input"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        [attr.aria-label]="label()"
        [placeholder]="placeholder()"
        [value]="ctrl.text()"
        (input)="ctrl.setText(input.value)"
        (keydown.escape)="clear()"
        (keydown.enter)="input.blur()"
      />
      @if (ctrl.text() || ctrl.active()) {
        <button matIconButton type="button" aria-label="Ryd søgning" (click)="clear()">
          <mat-icon svgIcon="close" />
        </button>
      }
    </div>

    <mat-chip-listbox class="app-filter-chips" [multiple]="true" aria-label="Filtre">
      @if (ctrl.isScoped()) {
        <mat-chip-option
          [selected]="ctrl.everywhere()"
          (selectionChange)="onChip($event, setEverywhere)"
        >
          Søg overalt
        </mat-chip-option>
      }
      <mat-chip-option
        [selected]="ctrl.favoritesOnly()"
        (selectionChange)="onChip($event, setFavorites)"
      >
        Favoritter
      </mat-chip-option>
      <mat-chip-option
        [selected]="ctrl.withPhoto()"
        (selectionChange)="onChip($event, setWithPhoto)"
      >
        Har billede
      </mat-chip-option>
      @for (option of ctrl.tagOptions(); track option.tag) {
        <mat-chip-option
          [selected]="ctrl.tags().includes(option.tag)"
          (selectionChange)="onTagChip($event, option.tag)"
        >
          #{{ option.tag }}
        </mat-chip-option>
      }
    </mat-chip-listbox>
  `,
  styles: `
    :host {
      display: block;
      padding-top: 4px;
    }
    .field {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 52px;
      padding: 0 4px 0 16px;
      border-radius: 26px;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
    }
    .field:focus-within {
      outline: 2px solid var(--mat-sys-primary);
    }
    input {
      flex: 1;
      min-width: 0;
      height: 48px;
      border: none;
      outline: none;
      background: transparent;
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-large);
    }
    input::placeholder {
      color: var(--mat-sys-on-surface-variant);
    }
    input::-webkit-search-cancel-button {
      display: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchField {
  readonly placeholder = input('Søg…');
  readonly label = input('Søg');

  protected readonly ctrl = inject(SearchController);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly setEverywhere = (value: boolean) => this.ctrl.setEverywhere(value);
  protected readonly setFavorites = (value: boolean) => this.ctrl.setFavoritesOnly(value);
  protected readonly setWithPhoto = (value: boolean) => this.ctrl.setWithPhoto(value);

  focus(): void {
    this.input().nativeElement.focus();
  }

  protected clear(): void {
    this.ctrl.clear();
    this.input().nativeElement.value = '';
  }

  protected onChip(event: MatChipSelectionChange, apply: (value: boolean) => void): void {
    if (event.isUserInput) apply(event.selected);
  }

  protected onTagChip(event: MatChipSelectionChange, tag: string): void {
    if (event.isUserInput) this.ctrl.setTag(tag, event.selected);
  }
}
