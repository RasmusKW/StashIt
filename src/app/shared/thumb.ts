import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PhotoStore } from '../core/photo-store';

/** Square thumbnail of a node's first photo; falls back to a box icon or the initial. */
@Component({
  selector: 'app-thumb',
  imports: [MatIcon],
  template: `
    @if (url(); as src) {
      <img [src]="src" alt="" decoding="async" />
    } @else if (container()) {
      <mat-icon svgIcon="box" aria-hidden="true" />
    } @else {
      <span aria-hidden="true">{{ initial() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: var(--thumb-size, 48px);
      height: var(--thumb-size, 48px);
      border-radius: 12px;
      overflow: hidden;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-title-medium);
    }
    :host(.container) {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.container]': 'container() && !url()' },
})
export class Thumb {
  readonly nodeId = input.required<string>();
  readonly name = input('');
  readonly container = input(false);

  private readonly photos = inject(PhotoStore);
  private readonly photoId = computed(() => this.photos.firstPhotoId(this.nodeId()));
  protected readonly url = signal<string | null>(null);
  protected readonly initial = computed(() => this.name().trim().charAt(0).toUpperCase() || '?');

  constructor() {
    effect(() => {
      const photoId = this.photoId();
      this.url.set(null);
      if (!photoId) return;
      this.photos
        .thumbnailUrl(photoId)
        .then((url) => {
          if (this.photoId() === photoId) this.url.set(url);
        })
        .catch(() => this.url.set(null));
    });
  }
}
