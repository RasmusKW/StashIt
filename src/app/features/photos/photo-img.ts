import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { PhotoStore } from '../../core/photo-store';

/** Thumbnail image of one photo (object URL from IndexedDB). */
@Component({
  selector: 'app-photo-img',
  template: `
    @if (url(); as src) {
      <img [src]="src" [attr.alt]="alt()" decoding="async" />
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      background: var(--mat-sys-surface-container-high);
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoImg {
  readonly photoId = input.required<string>();
  readonly alt = input('');

  private readonly photos = inject(PhotoStore);
  protected readonly url = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.photoId();
      this.photos
        .thumbnailUrl(id)
        .then((url) => {
          if (this.photoId() === id) this.url.set(url);
        })
        .catch(() => this.url.set(null));
    });
  }
}
