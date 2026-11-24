import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { NewNode } from '../core/models';
import { NodeStore } from '../core/node-store';
import { suggestNextName } from '../core/numbering';
import { PhotoStore } from '../core/photo-store';
import { parseQuickAdd, parseQuickAddLine, tagAtCaret } from '../core/quick-add-parser';
import { normalizeDa } from '../core/text';
import { UndoService } from '../core/undo.service';

/**
 * The quick-add bar fixed at the bottom of every view – the most important flow.
 *
 * - Enter creates one node per line inside the current node and keeps focus.
 * - "#tag" and "x200"/"200x" are parsed inline; "#" opens tag autocomplete.
 * - The camera button attaches a photo to the node created last in this view (or the
 *   current node if nothing was created yet).
 * - Typing "Kasse" when "Kasse 1" and "Kasse 2" exist suggests "Kasse 3".
 */
@Component({
  selector: 'app-quick-add',
  imports: [CdkTextareaAutosize, MatIconButton, MatIcon, MatProgressSpinner, MatTooltip],
  templateUrl: './quick-add.html',
  styleUrl: './quick-add.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickAdd {
  /** Where new nodes go (`null` = top level). */
  readonly parentId = input.required<string | null>();
  readonly placeholder = input('Tilføj…');
  readonly label = input('Tilføj');

  private readonly store = inject(NodeStore);
  private readonly photos = inject(PhotoStore);
  private readonly feedback = inject(UndoService);
  private readonly inputRef = viewChild.required<ElementRef<HTMLTextAreaElement>>('input');

  protected readonly text = signal('');
  private readonly caret = signal(0);
  protected readonly activeIndex = signal(-1);
  private readonly dismissedFor = signal<string | null>(null);
  private readonly lastCreatedId = signal<string | null>(null);
  protected readonly photoBusy = signal(false);
  protected readonly status = signal('');
  protected readonly announcement = signal('');

  private allowLineBreak = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    // Publish the bar's real height so page content and snackbars always clear it, also when
    // suggestion chips or several lines make it taller.
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    const root = document.documentElement;
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => {
        root.style.setProperty('--app-quick-add-space', `${Math.ceil(host.offsetHeight) + 16}px`);
      });
      observer.observe(host);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        root.style.removeProperty('--app-quick-add-space');
      });
    });
  }

  protected readonly lineCount = computed(() => parseQuickAdd(this.text()).length);

  /** "Kasse 3" when the single typed line is a known numbered prefix. */
  protected readonly numberSuggestion = computed(() => {
    const text = this.text();
    if (!text.trim() || /[\r\n]/.test(text)) return null;
    const parsed = parseQuickAddLine(text);
    return suggestNextName(this.store.numberIndex(), parsed.name);
  });

  private readonly tagContext = computed(() => tagAtCaret(this.text(), this.caret()));

  protected readonly tagSuggestions = computed(() => {
    const context = this.tagContext();
    if (!context || this.dismissedFor() === this.text()) return [];
    const partial = normalizeDa(context.partial);
    return this.store
      .tagCounts()
      .filter((t) => t.tag !== context.partial && normalizeDa(t.tag).startsWith(partial))
      .slice(0, 8);
  });

  /** The node a photo from the camera button is attached to. */
  protected readonly cameraTarget = computed(
    () => this.store.get(this.lastCreatedId()) ?? this.store.get(this.parentId()),
  );

  protected readonly cameraLabel = computed(() => {
    const target = this.cameraTarget();
    return target ? `Tag billede til «${target.name}»` : 'Opret først noget at tage billede af';
  });

  protected readonly focused = signal(false);

  protected readonly hint = computed(() => {
    const lines = this.lineCount();
    if (lines > 1) return `Enter opretter ${lines} ting`;
    if (this.status()) return this.status();
    if (this.focused() && !this.text())
      return 'F.eks. «Skruer 4x40 #jern x200» – én ting pr. linje';
    return '';
  });

  focus(): void {
    this.inputRef().nativeElement.focus();
  }

  protected onInput(): void {
    const el = this.inputRef().nativeElement;
    this.text.set(el.value);
    this.caret.set(el.selectionStart ?? el.value.length);
    this.activeIndex.set(-1);
    this.status.set('');
  }

  protected syncCaret(): void {
    const el = this.inputRef().nativeElement;
    this.caret.set(el.selectionStart ?? el.value.length);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.isComposing || event.keyCode === 229) return;
    const suggestions = this.tagSuggestions();
    if (suggestions.length > 0) {
      const count = suggestions.length;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex.update((i) => (i + step + count + (i < 0 && step < 0 ? 1 : 0)) % count);
        return;
      }
      const active = this.activeIndex();
      if ((event.key === 'Enter' && active >= 0) || (event.key === 'Tab' && !event.shiftKey)) {
        event.preventDefault();
        this.insertTag(suggestions[Math.max(0, active)].tag);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.dismissedFor.set(this.text());
        return;
      }
    }
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        this.allowLineBreak = true;
        return;
      }
      event.preventDefault();
      void this.submit();
    }
  }

  /** Virtual keyboards may not send a usable keydown for Enter; catch the line break here. */
  protected onBeforeInput(event: InputEvent): void {
    if (event.inputType !== 'insertLineBreak' && event.inputType !== 'insertParagraph') return;
    if (this.allowLineBreak) {
      this.allowLineBreak = false;
      return;
    }
    event.preventDefault();
    void this.submit();
  }

  protected insertTag(tag: string): void {
    const context = this.tagContext();
    const el = this.inputRef().nativeElement;
    if (!context) return;
    const before = el.value.slice(0, context.start);
    const after = el.value.slice(context.end);
    const inserted = `#${tag}${after.startsWith(' ') ? '' : ' '}`;
    el.value = before + inserted + after;
    const caret = before.length + inserted.length;
    el.setSelectionRange(caret, caret);
    el.focus();
    this.text.set(el.value);
    this.caret.set(caret);
    this.activeIndex.set(-1);
  }

  /** Creates one node per line. The field is cleared at once so typing can continue. */
  async submit(): Promise<void> {
    const el = this.inputRef().nativeElement;
    const raw = el.value;
    const items = parseQuickAdd(raw);
    el.focus();
    if (items.length === 0) {
      if (raw.trim()) this.say('Skriv et navn – tags og antal alene opretter ikke noget');
      return;
    }
    this.clear();
    await this.createItems(items, raw);
  }

  protected async acceptSuggestion(name: string): Promise<void> {
    const el = this.inputRef().nativeElement;
    const raw = el.value;
    const parsed = parseQuickAddLine(raw);
    this.clear();
    el.focus();
    await this.createItems([{ name, tags: parsed.tags, quantity: parsed.quantity }], raw);
  }

  protected async onPhoto(event: Event): Promise<void> {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    fileInput.value = '';
    const target = this.cameraTarget();
    if (!file || !target) return;
    this.photoBusy.set(true);
    try {
      await this.photos.addFile(target.id, file);
      this.say(`Billede tilføjet til «${target.name}»`);
    } catch (error) {
      this.feedback.error(error instanceof Error ? error.message : 'Billedet kunne ikke gemmes');
    } finally {
      this.photoBusy.set(false);
    }
  }

  /** Keeps focus in the text field when tapping helper buttons. */
  protected keepFocus(event: Event): void {
    event.preventDefault();
  }

  private createItems(items: NewNode[], raw: string): Promise<void> {
    const parentId = this.parentId();
    const run = this.queue.then(async () => {
      try {
        const created = await this.store.create(parentId, items);
        const last = created.at(-1);
        if (last) this.lastCreatedId.set(last.id);
        this.say(
          created.length === 1 ? `Oprettet: ${created[0].name}` : `Oprettet ${created.length} ting`,
        );
      } catch (error) {
        console.error(error);
        this.feedback.error('Kunne ikke gemme');
        const el = this.inputRef().nativeElement;
        if (!el.value) {
          el.value = raw;
          this.text.set(raw);
        }
      }
    });
    this.queue = run;
    return run;
  }

  private clear(): void {
    const el = this.inputRef().nativeElement;
    el.value = '';
    this.text.set('');
    this.caret.set(0);
    this.activeIndex.set(-1);
    this.dismissedFor.set(null);
  }

  private say(message: string): void {
    this.status.set(message);
    this.announcement.set(message);
  }
}
