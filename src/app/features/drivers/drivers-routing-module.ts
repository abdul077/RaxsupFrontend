import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./driver-list/driver-list').then(m => m.DriverListComponent),
    canActivate: [roleGuard(['Admin', 'Dispatcher', 'FleetManager'])]
  },
  {
    path: 'my-profile',
    loadComponent: () => import('./driver-detail/driver-detail').then(m => m.DriverDetailComponent),
    canActivate: [roleGuard(['Driver'])]
  },
  {
    path: 'my-referrals',
    loadComponent: () => import('./driver-detail/driver-detail').then(m => m.DriverDetailComponent),
    canActivate: [roleGuard(['Driver'])]
  },
  {
    path: 'my-incidents',
    loadComponent: () => import('./driver-incidents/driver-incidents').then(m => m.DriverIncidentsComponent),
    canActivate: [roleGuard(['Driver'])]
  },
  {
    path: 'my-vehicles',
    loadComponent: () => import('./driver-my-vehicles/driver-my-vehicles').then(m => m.DriverMyVehiclesComponent),
    canActivate: [roleGuard(['Driver'])]
  },
  {
    path: 'my-incidents/:id',
    loadComponent: () => import('./driver-incident-detail/driver-incident-detail').then(m => m.DriverIncidentDetailComponent),
    canActivate: [roleGuard(['Driver'])]
  },
  {
    path: 'create',
    loadComponent: () => import('./driver-create/driver-create').then(m => m.DriverCreateComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: 'reports',
    loadComponent: () => import('./driver-reports/driver-reports').then(m => m.DriverReportsComponent),
    canActivate: [roleGuard(['Admin', 'FleetManager', 'Accountant'])]
  },
  {
    path: 'documents',
    loadComponent: () => import('./driver-documents-management/driver-documents-management').then(m => m.DriverDocumentsManagementComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: 'settlements',
    loadComponent: () => import('./driver-settlements-management/driver-settlements-management').then(m => m.DriverSettlementsManagementComponent),
    canActivate: [roleGuard(['Admin', 'Accountant'])]
  },
  {
    path: 'inactive',
    loadComponent: () => import('./driver-list/driver-list').then(m => m.DriverListComponent),
    data: { inactiveOnly: true },
    canActivate: [roleGuard(['Admin', 'FleetManager'])]
  },
  // Referrals management is handled in driver-detail component
  // {
  //   path: 'referrals',
  //   loadComponent: () => import('./driver-referrals-management/driver-referrals-management').then(m => m.DriverReferralsManagementComponent),
  //   canActivate: [roleGuard(['Admin', 'Dispatcher', 'FleetManager'])]
  // },
  // Driver onboarding component not yet implemented
  // {
  //   path: 'onboarding',
  //   loadComponent: () => import('./driver-onboarding/driver-onboarding').then(m => m.DriverOnboardingComponent),
  //   canActivate: [roleGuard(['Admin'])]
  // },
  {
    path: ':id/loads',
    loadComponent: () => import('./driver-loads/driver-loads').then(m => m.DriverLoadsComponent),
    canActivate: [roleGuard(['Admin', 'Dispatcher', 'FleetManager', 'Driver'])]
  },
  {
    path: ':id/analytics',
    loadComponent: () => import('./driver-analytics/driver-analytics').then(m => m.DriverAnalyticsComponent),
    canActivate: [roleGuard(['Admin', 'Dispatcher', 'FleetManager'])]
  },
  {
    path: ':id/activity',
    loadComponent: () => import('./driver-activity/driver-activity').then(m => m.DriverActivityComponent),
    canActivate: [roleGuard(['Admin', 'Dispatcher', 'FleetManager'])]
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./driver-create/driver-create').then(m => m.DriverCreateComponent),
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: ':id',
    loadComponent: () => import('./driver-detail/driver-detail').then(m => m.DriverDetailComponent),
    canActivate: [roleGuard(['Admin', 'Dispatcher', 'FleetManager', 'Driver'])]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DriversRoutingModule { }
