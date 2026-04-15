import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { DriversRoutingModule } from './drivers-routing-module';
import { DriverListComponent } from './driver-list/driver-list';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DriversRoutingModule,
    DriverListComponent
  ]
})
export class DriversModule { }
