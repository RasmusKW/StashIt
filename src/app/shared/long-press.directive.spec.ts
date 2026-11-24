import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LongPressDirective } from './long-press.directive';

@Component({
  imports: [LongPressDirective],
  template: `<button (appLongPress)="presses.set(presses() + 1)" (click)="onClick()">x</button>`,
})
class Host {
  readonly presses = signal(0);
  readonly clicks = signal(0);
  onClick(): void {
    this.clicks.set(this.clicks() + 1);
  }
}

function pointer(type: string, init: PointerEventInit = {}): Event {
  // jsdom has no PointerEvent constructor; a MouseEvent with the extra fields is enough.
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
  Object.defineProperty(event, 'isPrimary', { value: true });
  return event;
}

describe('LongPressDirective', () => {
  let fixture: ComponentFixture<Host>;
  let button: HTMLButtonElement;

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    button = fixture.nativeElement.querySelector('button');
  });

  afterEach(() => vi.useRealTimers());

  it('fires after holding for 500 ms', () => {
    button.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(499);
    expect(fixture.componentInstance.presses()).toBe(0);
    vi.advanceTimersByTime(1);
    expect(fixture.componentInstance.presses()).toBe(1);
  });

  it('does not fire for a short tap or when the pointer moves', () => {
    button.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(200);
    button.dispatchEvent(pointer('pointerup'));
    vi.advanceTimersByTime(1000);
    button.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    button.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 0 }));
    vi.advanceTimersByTime(1000);
    expect(fixture.componentInstance.presses()).toBe(0);
  });

  it('fires on the context menu (right-click / long-press on Android)', () => {
    const event = pointer('contextmenu');
    button.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.presses()).toBe(1);
  });

  it('marks the click after a long press so the element can ignore it', () => {
    const directive = fixture.debugElement.children[0].injector.get(LongPressDirective);
    button.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(600);
    button.dispatchEvent(pointer('pointerup'));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    button.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(directive.consumeClick()).toBe(true);
    expect(directive.consumeClick()).toBe(false);
  });
});
