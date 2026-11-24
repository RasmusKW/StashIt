import { Injectable, computed, signal } from '@angular/core';

/** Multi-select state for node lists (started by a long press). */
@Injectable({ providedIn: 'root' })
export class SelectionService {
  private readonly _ids = signal<ReadonlySet<string>>(new Set());

  readonly ids = this._ids.asReadonly();
  readonly count = computed(() => this._ids().size);
  readonly active = computed(() => this._ids().size > 0);
  readonly list = computed(() => [...this._ids()]);

  isSelected(id: string): boolean {
    return this._ids().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this._ids());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this._ids.set(next);
  }

  select(id: string): void {
    if (!this._ids().has(id)) this._ids.set(new Set([...this._ids(), id]));
  }

  setAll(ids: Iterable<string>): void {
    this._ids.set(new Set(ids));
  }

  clear(): void {
    if (this._ids().size) this._ids.set(new Set());
  }
}
