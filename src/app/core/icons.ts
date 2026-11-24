import { inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { ICONS } from './icons.generated';

/** Registers the bundled SVG icons so `<mat-icon svgIcon="…">` never hits the network. */
export function registerIcons(): void {
  const registry = inject(MatIconRegistry);
  const sanitizer = inject(DomSanitizer);
  for (const [name, svg] of Object.entries(ICONS)) {
    // The SVG strings are generated at build time from a trusted npm package.
    registry.addSvgIconLiteral(name, sanitizer.bypassSecurityTrustHtml(svg));
  }
}
