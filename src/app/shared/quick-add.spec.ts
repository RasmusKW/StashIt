import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppDb } from '../core/db';
import { NodeStore } from '../core/node-store';
import { PhotoStore } from '../core/photo-store';
import { provideTestDb } from '../../testing/test-db';
import { QuickAdd } from './quick-add';

@Component({
  imports: [QuickAdd],
  template: `<app-quick-add [parentId]="parentId()" label="Tilføj" />`,
})
class Host {
  readonly parentId = signal<string | null>(null);
}

describe('QuickAdd', () => {
  let db: AppDb;
  let store: NodeStore;
  let fixture: ComponentFixture<Host>;
  let textarea: HTMLTextAreaElement;

  function type(value: string): void {
    textarea.value = value;
    textarea.setSelectionRange(value.length, value.length);
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function pressEnter(): Promise<void> {
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    // Let the queued create finish.
    await new Promise((r) => setTimeout(r, 20));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    db = provideTestDb();
    store = TestBed.inject(NodeStore);
    await TestBed.inject(PhotoStore).init();
    await store.init();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    textarea = fixture.nativeElement.querySelector('textarea');
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('creates a node on Enter, clears the field and keeps focus', async () => {
    textarea.focus();
    type('Kælder');
    await pressEnter();
    expect(store.children(null).map((n) => n.name)).toEqual(['Kælder']);
    expect(textarea.value).toBe('');
    expect(document.activeElement).toBe(textarea);
  });

  it('creates one node per line with tags and quantities in one action', async () => {
    const [room] = await store.create(null, [{ name: 'Kælder' }]);
    fixture.componentInstance.parentId.set(room.id);
    fixture.detectChanges();
    type('Spidstang #værktøj #tang\n\nSkruer 4x40 x200\n#kun-tags');
    await pressEnter();
    const children = store.children(room.id);
    expect(children.map((n) => n.name)).toEqual(['Skruer 4x40', 'Spidstang']);
    expect(children[0].quantity).toBe(200);
    expect(children[1].tags).toEqual(['værktøj', 'tang']);
  });

  it('does not create anything for tag-only input', async () => {
    type('#værktøj');
    await pressEnter();
    expect(store.count()).toBe(0);
    expect(textarea.value).toBe('#værktøj');
  });

  it('suggests the next free number and creates it with one tap', async () => {
    await store.create(null, [{ name: 'Kasse 1' }, { name: 'Kasse 2' }]);
    type('kasse #flyt');
    const chip = fixture.nativeElement.querySelector('.chip.suggestion') as HTMLButtonElement;
    expect(chip.textContent).toContain('Kasse 3');
    chip.click();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 20));
    const created = store.children(null).find((n) => n.name === 'Kasse 3');
    expect(created?.tags).toEqual(['flyt']);
  });

  it('autocompletes existing tags after #', async () => {
    await store.create(null, [{ name: 'Tang', tags: ['værktøj'] }]);
    type('Hammer #væ');
    const option = fixture.nativeElement.querySelector('[role="option"]') as HTMLButtonElement;
    expect(option.textContent).toContain('#værktøj');
    option.click();
    fixture.detectChanges();
    expect(textarea.value).toBe('Hammer #værktøj ');
  });
});
