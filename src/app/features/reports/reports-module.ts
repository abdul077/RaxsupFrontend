import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportsRoutingModule } from './reports-routing-module';
import { DashboardStatsComponent } from './dashboard-stats/dashboard-stats';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReportsRoutingModule,
    DashboardStatsComponent
  ]
})
export class ReportsModule { }
