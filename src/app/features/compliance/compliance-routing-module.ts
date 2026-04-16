import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';
import { ComplianceDashboardComponent } from './compliance-dashboard/compliance-dashboard';
import { ComplianceCalendarComponent } from './compliance-calendar/compliance-calendar';
import { IncidentListComponent } from './incident-list/incident-list';
import { IncidentCreateComponent } from './incident-create/incident-create';
import { IncidentDetailComponent } from './incident-detail/incident-detail';
import { InspectionCreateComponent } from './inspection-create/inspection-create';

// Eagerly reference route components so they ship in the compliance lazy chunk (one .js fetch),
// instead of per-route dynamic imports that triggered a second chunk request on the server.

const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    component: ComplianceDashboardComponent,
    canActivate: [roleGuard(['Admin', 'FleetManager', 'Dispatcher'])]
  },
  {
    path: 'incidents',
    component: IncidentListComponent,
    canActivate: [roleGuard(['Admin', 'FleetManager'])]
  },
  {
    path: 'incidents/create',
    component: IncidentCreateComponent,
    canActivate: [roleGuard(['Admin', 'FleetManager'])]
  },
  {
    path: 'incidents/:id',
    component: IncidentDetailComponent,
    canActivate: [roleGuard(['Admin', 'FleetManager'])]
  },
  {
    path: 'incidents/:id/edit',
    component: IncidentCreateComponent,
    canActivate: [roleGuard(['Admin', 'FleetManager'])]
  },
  {
    path: 'calendar',
    component: ComplianceCalendarComponent,
    canActivate: [roleGuard(['Admin', 'FleetManager'])]
  },
  {
    path: 'inspections/create',
    component: InspectionCreateComponent,
    canActivate: [roleGuard(['Admin', 'FleetManager'])]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ComplianceRoutingModule { }
