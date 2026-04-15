import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: 'users',
    loadComponent: () => import('./user-list/user-list').then(m => m.UserListComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: 'inactive-users',
    loadComponent: () => import('./user-list/user-list').then(m => m.UserListComponent),
    canActivate: [roleGuard(['Admin'])],
    data: { inactiveOnly: true }
  },
  {
    path: 'users/:id',
    loadComponent: () => import('./user-detail/user-detail').then(m => m.UserDetailComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: 'companies',
    loadComponent: () => import('./company-list/company-list').then(m => m.CompanyListComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: 'branches',
    loadComponent: () => import('./branch-list/branch-list').then(m => m.BranchListComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: 'api-keys',
    loadComponent: () => import('./api-key-list/api-key-list').then(m => m.ApiKeyListComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: 'notifications',
    loadComponent: () => import('./notification-list/notification-list').then(m => m.NotificationListComponent)
    // Accessible to all authenticated users - no role restriction
  },
  {
    path: 'audit-logs',
    loadComponent: () => import('./audit-log-list/audit-log-list').then(m => m.AuditLogListComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: 'email-logs',
    loadComponent: () => import('./email-log-list/email-log-list').then(m => m.EmailLogListComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: 'pending-drivers',
    loadComponent: () => import('./pending-drivers/pending-drivers').then(m => m.PendingDriversComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: 'rejected-drivers',
    loadComponent: () => import('./rejected-drivers/rejected-drivers').then(m => m.RejectedDriversComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: 'motive',
    loadComponent: () => import('./motive/motive-admin').then(m => m.MotiveAdminComponent),
    canActivate: [roleGuard(['Admin'])]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
