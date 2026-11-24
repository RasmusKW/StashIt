import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** How long the "Fortryd" snackbar stays (ms). */
export const UNDO_DURATION = 8000;

export interface UndoOptions {
  /** Called if the user taps "Fortryd". */
  undo: () => Promise<unknown> | unknown;
  /** Called when the snackbar goes away without undo (timeout or replaced by another). */
  expire?: () => Promise<unknown> | unknown;
}

/**
 * Undo instead of confirmations: actions are performed immediately and a snackbar offers
 * "Fortryd" for ~8 seconds.
 */
@Injectable({ providedIn: 'root' })
export class UndoService {
  private readonly snackBar = inject(MatSnackBar);

  show(message: string, options: UndoOptions): void {
    const ref = this.snackBar.open(message, 'Fortryd', {
      duration: UNDO_DURATION,
      panelClass: 'app-snackbar',
      politeness: 'polite',
    });
    ref.afterDismissed().subscribe(({ dismissedByAction }) => {
      const action = dismissedByAction ? options.undo : options.expire;
      Promise.resolve()
        .then(() => action?.())
        .catch((error: unknown) => {
          console.error(error);
          this.error(dismissedByAction ? 'Kunne ikke fortryde' : 'Noget gik galt');
        });
    });
  }

  info(message: string): void {
    this.snackBar.open(message, undefined, { duration: 3000, panelClass: 'app-snackbar' });
  }

  error(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 6000,
      panelClass: 'app-snackbar',
      politeness: 'assertive',
    });
  }
}
