import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./owner-operator-list/owner-operator-list').then(m => m.OwnerOperatorListComponent),
    canActivate: [roleGuard(['Admin', 'Dispatcher', 'FleetManager'])]
  },
  {
    path: 'create',
    loadComponent: () => import('./owner-operator-create/owner-operator-create').then(m => m.OwnerOperatorCreateComponent),
    canActivate: [roleGuard(['Admin', 'FleetManager'])]
  },
  {
    path: ':id',
    loadComponent: () => import('./owner-operator-detail/owner-operator-detail').then(m => m.OwnerOperatorDetailComponent),
    canActivate: [roleGuard(['Admin', 'Dispatcher', 'FleetManager'])]
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./owner-operator-create/owner-operator-create').then(m => m.OwnerOperatorCreateComponent),
    canActivate: [roleGuard(['Admin'])]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OwnerOperatorsRoutingModule { }

