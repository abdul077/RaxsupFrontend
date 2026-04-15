import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ComplianceRoutingModule } from './compliance-routing-module';
import { IncidentListComponent } from './incident-list/incident-list';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ComplianceRoutingModule,
    IncidentListComponent
  ]
})
export class ComplianceModule { }
