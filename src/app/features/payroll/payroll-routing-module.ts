import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    loadComponent: () => import('./payroll-list/payroll-list').then(m => m.PayrollListComponent),
    canActivate: [roleGuard(['Admin', 'Accountant', 'Dispatcher'])]
  },
  {
    path: 'create',
    loadComponent: () => import('./payroll-create/payroll-create').then(m => m.PayrollCreateComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  },
  {
    path: ':id',
    loadComponent: () => import('./payroll-detail/payroll-detail').then(m => m.PayrollDetailComponent),
    canActivate: [roleGuard(['Admin', 'Accountant', 'Dispatcher'])]
  },
  {
    path: 'sync-management',
    loadComponent: () => import('./everee-sync-management/everee-sync-management').then(m => m.EvereeSyncManagementComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PayrollRoutingModule { }

