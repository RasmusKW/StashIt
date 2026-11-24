import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
    title: 'Hvor er den?',
  },
  {
    path: 'n/:id',
    loadComponent: () => import('./features/node/node-page').then((m) => m.NodePage),
  },
  {
    path: 'indstillinger',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
    title: 'Indstillinger – Hvor er den?',
  },
  { path: '**', redirectTo: '' },
];
