import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PhotoStore } from '../../core/photo-store';
import { UndoService } from '../../core/undo.service';

export interface PhotoViewerData {
  nodeId: string;
  index: number;
  title: string;
}

/**
 * Fullscreen photo viewer. Swiping uses native horizontal scrolling with scroll snapping;
 * arrow buttons and the keyboard work on desktop. Deleting is undoable.
 */
@Component({
  selector: 'app-photo-viewer',
  imports: [MatIconButton, MatIcon],
  template: `
    <div class="bar">
      <button matIconButton (click)="close()" aria-label="Luk">
        <mat-icon svgIcon="close" />
      </button>
      <span class="title">
        {{ data.title }}
        @if (photoIds().length > 1) {
          <span class="counter">{{ current() + 1 }} / {{ photoIds().length }}</span>
        }
      </span>
      <button matIconButton (click)="deleteCurrent()" aria-label="Slet billede">
        <mat-icon svgIcon="delete" />
      </button>
    </div>

    <div class="track" #track (scroll)="onScroll()" tabindex="-1">
      @for (photoId of photoIds(); track photoId; let i = $index) {
        <div class="slide">
          @if (urls()[photoId]; as src) {
            <img [src]="src" [attr.alt]="'Billede ' + (i + 1) + ' af ' + photoIds().length" />
          }
        </div>
      }
    </div>

    @if (photoIds().length > 1) {
      <button
        matIconButton
        class="nav prev"
        [disabled]="current() === 0"
        (click)="go(current() - 1)"
        aria-label="Forrige billede"
      >
        <mat-icon svgIcon="chevron-left" />
      </button>
      <button
        matIconButton
        class="nav next"
        [disabled]="current() >= photoIds().length - 1"
        (click)="go(current() + 1)"
        aria-label="Næste billede"
      >
        <mat-icon svgIcon="chevron-right" />
      </button>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #000;
      color: #fff;
      --mat-icon-button-icon-color: #fff;
      --mat-icon-button-disabled-icon-color: rgb(255 255 255 / 38%);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: calc(4px + env(safe-area-inset-top)) 4px 4px;
      z-index: 1;
    }
    .title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font: var(--mat-sys-title-medium);
    }
    .counter {
      margin-left: 8px;
      opacity: 0.75;
      font: var(--mat-sys-body-medium);
    }
    .track {
      flex: 1;
      display: flex;
      overflow-x: auto;
      overflow-y: hidden;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      outline: none;
    }
    .track::-webkit-scrollbar {
      display: none;
    }
    .slide {
      flex: 0 0 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      scroll-snap-align: center;
      scroll-snap-stop: always;
      padding-bottom: env(safe-area-inset-bottom);
      box-sizing: border-box;
    }
    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      user-select: none;
    }
    .nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgb(0 0 0 / 45%);
    }
    .prev {
      left: 8px;
    }
    .next {
      right: 8px;
    }
    @media (hover: none) {
      .nav {
        display: none;
      }
    }
  `,
  host: { '(keydown)': 'onKeydown($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoViewer implements OnDestroy {
  protected readonly data = inject<PhotoViewerData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PhotoViewer>);
  private readonly photos = inject(PhotoStore);
  private readonly undo = inject(UndoService);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  protected readonly photoIds = computed(() => this.photos.photoIds(this.data.nodeId));
  protected readonly current = signal(this.data.index);
  protected readonly urls = signal<Record<string, string>>({});
  private readonly loading = new Set<string>();

  constructor() {
    // Load full-size images as photos appear (including ones restored by undo).
    effect(() => {
      for (const id of this.photoIds()) {
        if (this.loading.has(id)) continue;
        this.loading.add(id);
        void this.photos.fullUrl(id).then((url) => {
          if (url) this.urls.update((urls) => ({ ...urls, [id]: url }));
        });
      }
    });
    afterNextRender(() => this.go(this.data.index, 'instant'));
  }

  ngOnDestroy(): void {
    for (const url of Object.values(this.urls())) URL.revokeObjectURL(url);
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected onScroll(): void {
    const el = this.track().nativeElement;
    if (el.clientWidth === 0) return;
    this.current.set(Math.round(el.scrollLeft / el.clientWidth));
  }

  protected go(index: number, behavior: ScrollBehavior = 'smooth'): void {
    const count = this.photoIds().length;
    const target = Math.max(0, Math.min(index, count - 1));
    const el = this.track().nativeElement;
    el.scrollTo({ left: target * el.clientWidth, behavior });
    this.current.set(target);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') this.go(this.current() - 1);
    else if (event.key === 'ArrowRight') this.go(this.current() + 1);
    else if (event.key === 'Delete') void this.deleteCurrent();
    else return;
    event.preventDefault();
  }

  protected async deleteCurrent(): Promise<void> {
    const ids = this.photoIds();
    const id = ids[this.current()];
    if (!id) return;
    const removed = await this.photos.remove(id);
    if (!removed) return;
    if (this.photoIds().length === 0) this.close();
    else this.current.set(Math.min(this.current(), this.photoIds().length - 1));
    this.undo.show('Billedet er slettet', { undo: () => this.photos.restore(removed) });
  }
}
