import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { NodeStore } from '../../core/node-store';
import { containersFirst } from '../../core/ordering';
import { SelectionService } from '../../core/selection.service';
import { NodeActions } from '../../shared/node-actions';
import { Breadcrumb } from '../../shared/breadcrumb';
import { NodeList } from '../../shared/node-list';
import { QuickAdd } from '../../shared/quick-add';
import { PhotoStrip } from '../photos/photo-strip';
import { InlineName } from './inline-name';
import { TagEditor } from './tag-editor';

/** The same view for every node: breadcrumb, inline-editable details and its contents. */
@Component({
  selector: 'app-node-page',
  imports: [
    RouterLink,
    CdkTextareaAutosize,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatInput,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    Breadcrumb,
    NodeList,
    QuickAdd,
    InlineName,
    TagEditor,
    PhotoStrip,
  ],
  templateUrl: './node-page.html',
  styleUrl: './node-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodePage {
  /** Route parameter (`/n/:id`). */
  readonly id = input.required<string>();

  private readonly store = inject(NodeStore);
  private readonly actions = inject(NodeActions);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  protected readonly selection = inject(SelectionService);
  protected readonly photoStrip = viewChild<PhotoStrip>('photoStrip');

  protected readonly node = computed(() => this.store.get(this.id()));
  protected readonly children = computed(() =>
    containersFirst(this.store.children(this.id()), (id) => this.store.childCount(id)),
  );
  protected readonly parentLink = computed(() => {
    const parentId = this.node()?.parentId;
    return parentId ? ['/n', parentId] : ['/'];
  });
  protected readonly parentName = computed(
    () => this.store.get(this.node()?.parentId)?.name ?? 'forsiden',
  );

  /** Local copies so saving (which trims) never fights with the user's typing. */
  protected readonly notes = signal('');
  protected readonly quantity = signal('');
  private notesTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        const node = this.store.get(id);
        this.notes.set(node?.notes ?? '');
        this.quantity.set(node?.quantity?.toString() ?? '');
        if (node) void this.store.markViewed(id);
      });
    });
    effect(() => {
      const name = this.node()?.name;
      this.title.setTitle(name ? `${name} – Hvor er den?` : 'Findes ikke – Hvor er den?');
    });
  }

  protected rename(name: string): void {
    void this.store.update(this.id(), { name });
  }

  protected toggleFavorite(): void {
    const node = this.node();
    if (node) void this.store.update(node.id, { favorite: !node.favorite });
  }

  protected setTags(tags: string[]): void {
    void this.store.update(this.id(), { tags });
  }

  protected onQuantityInput(value: string): void {
    this.quantity.set(value);
  }

  protected saveQuantity(): void {
    const raw = this.quantity().trim();
    const value = raw === '' ? undefined : Number(raw.replace(',', '.'));
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      this.quantity.set(this.node()?.quantity?.toString() ?? '');
      return;
    }
    void this.store.update(this.id(), { quantity: value });
    this.quantity.set(value === undefined ? '' : String(Math.round(value)));
  }

  protected onNotesInput(value: string): void {
    this.notes.set(value);
    if (this.notesTimer) clearTimeout(this.notesTimer);
    this.notesTimer = setTimeout(() => this.saveNotes(), 600);
  }

  protected saveNotes(): void {
    if (this.notesTimer) clearTimeout(this.notesTimer);
    this.notesTimer = null;
    void this.store.update(this.id(), { notes: this.notes() });
  }

  protected selectAll(): void {
    this.selection.setAll(this.children().map((child) => child.id));
  }

  protected async deleteNode(): Promise<void> {
    const id = this.id();
    const parent = this.parentLink();
    await this.router.navigate(parent);
    await this.actions.delete([id], { onUndo: () => void this.router.navigate(['/n', id]) });
  }
}
