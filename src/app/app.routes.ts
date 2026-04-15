import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { LayoutComponent } from './shared/components/layout/layout';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth-routing-module').then(m => m.AuthRoutingModule)
  },
  {
    path: 'referral',
    loadChildren: () => import('./features/auth/auth-routing-module').then(m => m.AuthRoutingModule)
  },
  {
    path: 'ref/:refId',
    loadComponent: () => import('./features/auth/ref-redirect/ref-redirect').then(m => m.RefRedirectComponent)
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard-routing-module').then(m => m.DashboardRoutingModule)
      },
      {
        path: 'loads',
        loadChildren: () => import('./features/loads/loads-routing-module').then(m => m.LoadsRoutingModule)
      },
      {
        path: 'drivers',
        loadChildren: () => import('./features/drivers/drivers-routing-module').then(m => m.DriversRoutingModule)
      },
      {
        path: 'owner-operators',
        loadChildren: () => import('./features/owner-operators/owner-operators-routing-module').then(m => m.OwnerOperatorsRoutingModule)
      },
      {
        path: 'customers',
        loadChildren: () => import('./features/customers/customers-routing-module').then(m => m.CustomersRoutingModule)
      },
      {
        path: 'equipment',
        loadChildren: () => import('./features/equipment/equipment-routing-module').then(m => m.EquipmentRoutingModule)
      },
      {
        path: 'financial',
        loadChildren: () => import('./features/financial/financial-routing-module').then(m => m.FinancialRoutingModule)
      },
      {
        path: 'payroll',
        loadChildren: () => import('./features/payroll/payroll-routing-module').then(m => m.PayrollRoutingModule)
      },
      {
        path: 'compliance',
        loadChildren: () => import('./features/compliance/compliance-routing-module').then(m => m.ComplianceRoutingModule)
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin-routing-module').then(m => m.AdminRoutingModule)
      },
      {
        path: 'reports',
        loadChildren: () => import('./features/reports/reports-routing-module').then(m => m.ReportsRoutingModule)
      },
      {
        path: 'messaging',
        loadChildren: () => import('./features/messaging/messaging-routing-module').then(m => m.MessagingRoutingModule)
      },
      {
        path: 'profile',
        loadChildren: () => import('./features/profile/profile-routing-module').then(m => m.ProfileRoutingModule)
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
