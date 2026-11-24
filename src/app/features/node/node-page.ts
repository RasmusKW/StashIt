import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-node-page',
  template: `<p>NodePage</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodePage {}
