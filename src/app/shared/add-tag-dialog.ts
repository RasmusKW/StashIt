import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatAutocomplete, MatAutocompleteTrigger, MatOption } from '@angular/material/autocomplete';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { NodeStore } from '../core/node-store';
import { normalizeDa, normalizeTag, plural } from '../core/text';

export interface AddTagDialogData {
  count: number;
}

/** Asks for one tag (with autocomplete) to add to the selected nodes. */
@Component({
  selector: 'app-add-tag-dialog',
  imports: [
    MatButton,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatOption,
  ],
  template: `
    <h2 mat-dialog-title>Tilføj tag til {{ countText }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="field">
        <mat-label>Tag</mat-label>
        <input
          matInput
          #tagInput
          autocapitalize="none"
          autocomplete="off"
          enterkeyhint="done"
          [value]="value()"
          (input)="value.set(tagInput.value)"
          (keydown.enter)="onEnter()"
          [matAutocomplete]="auto"
        />
        <mat-hint>Uden # og uden mellemrum</mat-hint>
      </mat-form-field>
      <mat-autocomplete #auto="matAutocomplete" (optionSelected)="value.set($event.option.value)">
        @for (option of suggestions(); track option.tag) {
          <mat-option [value]="option.tag">#{{ option.tag }}</mat-option>
        }
      </mat-autocomplete>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close type="button">Annuller</button>
      <button matButton="filled" type="button" [disabled]="!tag()" (click)="save()">Tilføj</button>
    </mat-dialog-actions>
  `,
  styles: `
    .field {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTagDialog {
  private readonly data = inject<AddTagDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AddTagDialog, string>>(MatDialogRef);
  private readonly store = inject(NodeStore);
  private readonly trigger = viewChild.required(MatAutocompleteTrigger);

  protected readonly countText = plural(this.data.count, 'ting', 'ting');
  protected readonly value = signal('');
  protected readonly tag = computed(() => normalizeTag(this.value()));
  protected readonly suggestions = computed(() => {
    const typed = normalizeDa(this.tag());
    return this.store
      .tagCounts()
      .filter((t) => normalizeDa(t.tag).startsWith(typed))
      .slice(0, 8);
  });

  protected onEnter(): void {
    if (this.trigger().activeOption) return;
    this.save();
  }

  protected save(): void {
    if (this.tag()) this.ref.close(this.tag());
  }
}
