import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./equipment-list/equipment-list').then(m => m.EquipmentListComponent),
    canActivate: [roleGuard(['Admin', 'FleetManager'])]
  },
  {
    path: ':id',
    loadComponent: () => import('./equipment-detail/equipment-detail').then(m => m.EquipmentDetailComponent),
    canActivate: [roleGuard(['Admin', 'FleetManager', 'Driver'])]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EquipmentRoutingModule { }
