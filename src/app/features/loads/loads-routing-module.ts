import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';
import { LoadListComponent } from './load-list/load-list';
import { LoadCreateComponent } from './load-create/load-create';
import { AccessorialTypeListComponent } from './accessorial-type-list/accessorial-type-list';
import { LoadDetailComponent } from './load-detail/load-detail';

// Use route `component` (not `loadComponent`) so list/detail/create share the loads lazy
// chunk. Per-route lazy chunks often 404 after deploy when index.html is cached or uploads
// are incomplete ("Failed to fetch dynamically imported module").
const routes: Routes = [
  {
    path: '',
    component: LoadListComponent,
    canActivate: [roleGuard(['Admin', 'Dispatcher', 'FleetManager', 'Driver'])]
  },
  {
    path: 'create',
    component: LoadCreateComponent,
    canActivate: [roleGuard(['Admin', 'Dispatcher'])]
  },
  {
    path: 'accessorial-types',
    component: AccessorialTypeListComponent,
    canActivate: [roleGuard(['Admin'])]
  },
  {
    path: ':id',
    component: LoadDetailComponent,
    canActivate: [roleGuard(['Admin', 'Dispatcher', 'FleetManager', 'Driver'])]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LoadsRoutingModule { }
