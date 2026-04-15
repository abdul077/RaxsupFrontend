import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'my-profile',
    pathMatch: 'full'
  },
  {
    path: 'my-profile',
    loadComponent: () => import('./my-profile/my-profile').then(m => m.MyProfileComponent)
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings').then(m => m.SettingsComponent)
  },
  {
    path: 'help',
    loadComponent: () => import('./help-support/help-support').then(m => m.HelpSupportComponent)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProfileRoutingModule { }

