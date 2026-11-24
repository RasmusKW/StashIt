import { Directive, OnDestroy, output } from '@angular/core';

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Emits `appLongPress` after holding a pointer down for 500 ms without moving, and on the
 * context menu event (right-click, Shift+F10, Android long-press). The click that follows a
 * long press is swallowed so it does not also activate the element.
 */
@Directive({
  selector: '[appLongPress]',
  host: {
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'cancel()',
    '(pointercancel)': 'cancel()',
    '(pointerleave)': 'cancel()',
    '(contextmenu)': 'onContextMenu($event)',
    '(click)': 'onClick($event)',
    '[style.-webkit-touch-callout]': '"none"',
  },
})
export class LongPressDirective implements OnDestroy {
  readonly appLongPress = output<void>();

  private timer: ReturnType<typeof setTimeout> | null = null;
  private startX = 0;
  private startY = 0;
  private suppressClick = false;
  private lastFired = 0;

  onDown(event: PointerEvent): void {
    if (event.button !== 0 || !event.isPrimary) return;
    this.cancel();
    this.suppressClick = false;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.timer = setTimeout(() => this.fire(), LONG_PRESS_MS);
  }

  onMove(event: PointerEvent): void {
    if (this.timer === null) return;
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) this.cancel();
  }

  onContextMenu(event: Event): void {
    event.preventDefault();
    if (Date.now() - this.lastFired < 1000) return;
    this.fire();
  }

  onClick(event: MouseEvent): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  /** True (once) if the current click is the tail of a long press and must be ignored. */
  consumeClick(): boolean {
    const suppressed = this.suppressClick;
    this.suppressClick = false;
    return suppressed;
  }

  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  ngOnDestroy(): void {
    this.cancel();
  }

  private fire(): void {
    this.timer = null;
    this.suppressClick = true;
    this.lastFired = Date.now();
    navigator.vibrate?.(15);
    this.appLongPress.emit();
  }
}
