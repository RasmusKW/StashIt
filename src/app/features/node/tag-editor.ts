import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { COMMA, ENTER, SPACE } from '@angular/cdk/keycodes';
import {
  MatAutocomplete,
  MatAutocompleteSelectedEvent,
  MatAutocompleteTrigger,
  MatOption,
} from '@angular/material/autocomplete';
import { MatChipGrid, MatChipInput, MatChipInputEvent, MatChipRemove, MatChipRow } from '@angular/material/chips';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { NodeStore } from '../../core/node-store';
import { normalizeDa, normalizeTag } from '../../core/text';

/** Tags as removable chips plus an input with autocomplete of existing tags. */
@Component({
  selector: 'app-tag-editor',
  imports: [
    MatFormField,
    MatLabel,
    MatChipGrid,
    MatChipRow,
    MatChipRemove,
    MatChipInput,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatOption,
    MatIcon,
  ],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="field">
      <mat-label>Tags</mat-label>
      <mat-chip-grid #grid aria-label="Tags">
        @for (tag of tags(); track tag) {
          <mat-chip-row (removed)="remove(tag)">
            #{{ tag }}
            <button matChipRemove [attr.aria-label]="'Fjern tag ' + tag">
              <mat-icon svgIcon="close" />
            </button>
          </mat-chip-row>
        }
        <input
          #tagInput
          placeholder="Tilføj tag…"
          aria-label="Tilføj tag"
          autocapitalize="none"
          enterkeyhint="done"
          [value]="draft()"
          (input)="draft.set(tagInput.value)"
          [matChipInputFor]="grid"
          [matChipInputSeparatorKeyCodes]="separators"
          [matChipInputAddOnBlur]="true"
          (matChipInputTokenEnd)="add($event)"
          [matAutocomplete]="auto"
        />
      </mat-chip-grid>
      <mat-autocomplete #auto="matAutocomplete" (optionSelected)="selected($event)">
        @for (suggestion of suggestions(); track suggestion.tag) {
          <mat-option [value]="suggestion.tag">
            #{{ suggestion.tag }} <span class="count">({{ suggestion.count }})</span>
          </mat-option>
        }
      </mat-autocomplete>
    </mat-form-field>
  `,
  styles: `
    :host {
      display: block;
    }
    .field {
      width: 100%;
    }
    .count {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagEditor {
  readonly tags = input.required<readonly string[]>();
  readonly tagsChange = output<string[]>();

  private readonly store = inject(NodeStore);
  private readonly trigger = viewChild.required(MatAutocompleteTrigger);
  protected readonly separators = [ENTER, COMMA, SPACE];
  protected readonly draft = signal('');

  protected readonly suggestions = computed(() => {
    const typed = normalizeDa(normalizeTag(this.draft()));
    const current = this.tags();
    return this.store
      .tagCounts()
      .filter((t) => !current.includes(t.tag) && normalizeDa(t.tag).startsWith(typed))
      .slice(0, 8);
  });

  protected add(event: MatChipInputEvent): void {
    // An option picked from the autocomplete is handled by selected().
    if (this.trigger().activeOption) return;
    this.addTag(event.value);
    event.chipInput.clear();
    this.draft.set('');
  }

  protected selected(event: MatAutocompleteSelectedEvent): void {
    this.addTag(String(event.option.value));
    this.draft.set('');
    event.option.deselect();
  }

  protected remove(tag: string): void {
    this.tagsChange.emit(this.tags().filter((t) => t !== tag));
  }

  private addTag(raw: string): void {
    const tag = normalizeTag(raw);
    if (!tag || this.tags().includes(tag)) return;
    this.tagsChange.emit([...this.tags(), tag]);
  }
}
