import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/** The node's name as a heading; tap to rename inline (Enter/blur saves, Escape cancels). */
@Component({
  selector: 'app-inline-name',
  template: `
    @if (editing()) {
      <input
        #input
        class="name-input"
        aria-label="Navn"
        [value]="name()"
        enterkeyhint="done"
        (keydown.enter)="commit()"
        (keydown.escape)="cancel()"
        (blur)="commit()"
      />
    } @else {
      <h1>
        <button type="button" class="name-button" (click)="edit()" title="Tryk for at omdøbe">
          {{ name() }}<span class="visually-hidden"> – tryk for at omdøbe</span>
        </button>
      </h1>
    }
  `,
  styles: `
    :host {
      display: block;
      flex: 1;
      min-width: 0;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }
    .name-button,
    .name-input {
      width: 100%;
      box-sizing: border-box;
      min-height: 48px;
      padding: 6px 8px;
      margin: 0;
      border-radius: 12px;
      font: var(--mat-sys-headline-small);
      color: var(--mat-sys-on-surface);
      text-align: left;
    }
    .name-button {
      border: none;
      background: none;
      cursor: text;
      overflow-wrap: anywhere;
    }
    .name-button:hover {
      background: color-mix(in srgb, var(--mat-sys-on-surface) 6%, transparent);
    }
    .name-input {
      border: 2px solid var(--mat-sys-primary);
      background: var(--mat-sys-surface-container-highest);
      outline: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineName {
  readonly name = input.required<string>();
  readonly renamed = output<string>();

  private readonly injector = inject(Injector);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  protected readonly editing = signal(false);

  protected edit(): void {
    this.editing.set(true);
    afterNextRender(
      () => {
        const el = this.input()?.nativeElement;
        el?.focus();
        el?.select();
      },
      { injector: this.injector },
    );
  }

  protected commit(): void {
    if (!this.editing()) return;
    const value = this.input()?.nativeElement.value.trim() ?? '';
    this.editing.set(false);
    if (value && value !== this.name()) this.renamed.emit(value);
  }

  protected cancel(): void {
    this.editing.set(false);
  }
}
