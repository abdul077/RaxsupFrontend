import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard-stats/dashboard-stats').then(m => m.DashboardStatsComponent),
    canActivate: [roleGuard(['Admin', 'FleetManager', 'Accountant'])]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReportsRoutingModule { }
