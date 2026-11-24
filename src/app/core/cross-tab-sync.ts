import { Injectable, OnDestroy } from '@angular/core';

const CHANNEL = 'hvor-er-den-sync';

/**
 * Tells other open tabs/windows of the app (e.g. the installed PWA and a browser tab) that the
 * data changed, so they reload instead of overwriting newer data with stale in-memory copies.
 */
@Injectable({ providedIn: 'root' })
export class CrossTabSync implements OnDestroy {
  private readonly channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);

  /** Announce a local change (never echoed back to this tab). */
  notify(): void {
    this.channel?.postMessage('changed');
  }

  /** Calls `handler` when another tab changed something. */
  listen(handler: () => void): void {
    if (this.channel) this.channel.onmessage = () => handler();
  }

  ngOnDestroy(): void {
    this.channel?.close();
  }
}
