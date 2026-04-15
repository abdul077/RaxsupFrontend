import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./customer-list/customer-list').then(m => m.CustomerListComponent),
    canActivate: [roleGuard(['Admin', 'Dispatcher', 'Accountant'])]
  },
  {
    path: ':id',
    loadComponent: () => import('./customer-detail/customer-detail').then(m => m.CustomerDetailComponent),
    canActivate: [roleGuard(['Admin', 'Dispatcher', 'Accountant'])]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CustomersRoutingModule { }
