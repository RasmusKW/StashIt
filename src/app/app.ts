import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs';
import { AppStatus } from './core/app-init';
import { SelectionService } from './core/selection.service';

/** Shell: router outlet, global keyboard shortcut, update notice and fatal-error state. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    @if (status.initError(); as error) {
      <main class="app-page fatal" role="alert">
        <h1>Hvor er den?</h1>
        <p>{{ error }}</p>
      </main>
    } @else {
      <router-outlet />
    }
  `,
  styles: `
    .fatal {
      padding-top: 48px;
    }
  `,
  host: { '(document:keydown)': 'onKeydown($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly status = inject(AppStatus);

  constructor() {
    const router = inject(Router);
    const selection = inject(SelectionService);
    const destroyRef = inject(DestroyRef);

    const nav = router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => selection.clear());
    destroyRef.onDestroy(() => nav.unsubscribe());

    const updates = inject(SwUpdate);
    if (updates.isEnabled) {
      const snackBar = inject(MatSnackBar);
      const sub = updates.versionUpdates
        .pipe(filter((event) => event.type === 'VERSION_READY'))
        .subscribe(() => {
          snackBar
            .open('Der er en ny version af appen', 'Genindlæs', { panelClass: 'app-snackbar' })
            .onAction()
            .subscribe(() => document.location.reload());
        });
      destroyRef.onDestroy(() => sub.unsubscribe());
    }
  }

  /** "/" focuses the search field (desktop), unless the user is typing somewhere. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const search = document.getElementById('search-input');
    if (search) {
      event.preventDefault();
      search.focus();
    }
  }
}
