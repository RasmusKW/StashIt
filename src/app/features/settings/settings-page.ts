import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-settings-page',
  template: `<p>SettingsPage</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {}
