import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-home-page',
  template: `<p>HomePage</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {}
