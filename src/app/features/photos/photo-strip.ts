import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { PhotoStore } from '../../core/photo-store';
import { UndoService } from '../../core/undo.service';
import { PhotoImg } from './photo-img';
import { PhotoViewer, PhotoViewerData } from './photo-viewer';

/** Horizontal row of a node's photos; tap opens the fullscreen viewer. */
@Component({
  selector: 'app-photo-strip',
  imports: [MatIcon, MatProgressSpinner, PhotoImg],
  template: `
    <ul class="strip" aria-label="Billeder">
      @for (photoId of photoIds(); track photoId; let i = $index) {
        <li>
          <button
            type="button"
            class="tile"
            [attr.aria-label]="'Vis billede ' + (i + 1) + ' af ' + photoIds().length"
            (click)="open(i)"
          >
            <app-photo-img [photoId]="photoId" />
          </button>
        </li>
      }
      <li>
        <button
          type="button"
          class="tile add"
          [disabled]="busy()"
          aria-label="Tilføj billede"
          (click)="pick()"
        >
          @if (busy()) {
            <mat-progress-spinner mode="indeterminate" diameter="28" aria-label="Gemmer billede" />
          } @else {
            <mat-icon svgIcon="add-photo" aria-hidden="true" />
            <span>Billede</span>
          }
        </button>
      </li>
    </ul>
    <input #picker type="file" accept="image/*" multiple hidden (change)="onFiles($event)" />
  `,
  styles: `
    :host {
      display: block;
    }
    .strip {
      display: flex;
      gap: 8px;
      margin: 0;
      padding: 2px;
      list-style: none;
      overflow-x: auto;
      scroll-snap-type: x proximity;
    }
    li {
      flex: none;
      scroll-snap-align: start;
    }
    .tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      width: 88px;
      height: 88px;
      padding: 0;
      border: none;
      border-radius: 16px;
      overflow: hidden;
      cursor: pointer;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    .tile.add {
      border: 1px dashed var(--mat-sys-outline);
      background: transparent;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoStrip {
  readonly nodeId = input.required<string>();
  readonly nodeName = input('');

  private readonly photos = inject(PhotoStore);
  private readonly dialog = inject(MatDialog);
  private readonly feedback = inject(UndoService);
  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  protected readonly photoIds = computed(() => this.photos.photoIds(this.nodeId()));
  protected readonly busy = signal(false);

  /** Opens the file picker (camera or gallery). */
  pick(): void {
    this.picker().nativeElement.click();
  }

  protected async onFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;
    this.busy.set(true);
    let failed = 0;
    for (const file of files) {
      try {
        await this.photos.addFile(this.nodeId(), file);
      } catch {
        failed++;
      }
    }
    this.busy.set(false);
    if (failed) this.feedback.error(`${failed} billede(r) kunne ikke læses`);
  }

  protected open(index: number): void {
    this.dialog.open<PhotoViewer, PhotoViewerData>(PhotoViewer, {
      data: { nodeId: this.nodeId(), index, title: this.nodeName() },
      width: '100vw',
      height: '100dvh',
      maxWidth: '100vw',
      maxHeight: '100dvh',
      panelClass: 'app-photo-viewer-panel',
      backdropClass: 'app-photo-viewer-backdrop',
      ariaLabel: `Billeder af ${this.nodeName()}`,
      autoFocus: 'dialog',
    });
  }
}
