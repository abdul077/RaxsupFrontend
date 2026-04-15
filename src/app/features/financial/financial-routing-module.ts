import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'invoices',
    pathMatch: 'full'
  },
  {
    path: 'invoices',
    loadComponent: () => import('./invoice-list/invoice-list').then(m => m.InvoiceListComponent),
    canActivate: [roleGuard(['Admin', 'Accountant', 'Dispatcher'])]
  },
  {
    path: 'invoices/create',
    loadComponent: () => import('./invoice-create/invoice-create').then(m => m.InvoiceCreateComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  },
  {
    path: 'invoices/:id',
    loadComponent: () => import('./invoice-detail/invoice-detail').then(m => m.InvoiceDetailComponent),
    canActivate: [roleGuard(['Admin', 'Accountant', 'Dispatcher'])]
  },
  {
    path: 'invoices/:id/edit',
    loadComponent: () => import('./invoice-create/invoice-create').then(m => m.InvoiceCreateComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  },
  {
    path: 'settlements',
    loadComponent: () => import('./settlement-list/settlement-list').then(m => m.SettlementListComponent),
    canActivate: [roleGuard(['Admin', 'Accountant', 'Dispatcher'])]
  },
  {
    path: 'settlements/create',
    loadComponent: () => import('./settlement-create/settlement-create').then(m => m.SettlementCreateComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  },
  {
    path: 'settlements/:id',
    loadComponent: () => import('./settlement-detail/settlement-detail').then(m => m.SettlementDetailComponent),
    canActivate: [roleGuard(['Admin', 'Accountant', 'Dispatcher'])]
  },
  {
    path: 'payments',
    loadComponent: () => import('./payments-list/payments-list').then(m => m.PaymentsListComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  },
  {
    path: 'reports',
    loadComponent: () => import('./financial-reports/financial-reports').then(m => m.FinancialReportsComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  },
  {
    path: 'accounts-payable',
    loadComponent: () => import('./accounts-payable-list/accounts-payable-list').then(m => m.AccountsPayableListComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  },
  {
    path: 'accounts-payable/create',
    loadComponent: () => import('./accounts-payable-create/accounts-payable-create').then(m => m.AccountsPayableCreateComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  },
  {
    path: 'accounts-payable/:id',
    loadComponent: () => import('./accounts-payable-detail/accounts-payable-detail').then(m => m.AccountsPayableDetailComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  },
  {
    path: 'accounts-receivable',
    loadComponent: () => import('./accounts-receivable-list/accounts-receivable-list').then(m => m.AccountsReceivableListComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  },
  {
    path: 'accounts-receivable/create',
    loadComponent: () => import('./accounts-receivable-create/accounts-receivable-create').then(m => m.AccountsReceivableCreateComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  },
  {
    path: 'accounts-receivable/:id',
    loadComponent: () => import('./accounts-receivable-detail/accounts-receivable-detail').then(m => m.AccountsReceivableDetailComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FinancialRoutingModule { }
