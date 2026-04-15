import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { LoadsRoutingModule } from './loads-routing-module';
import { LoadListComponent } from './load-list/load-list';
import { LoadCreateComponent } from './load-create/load-create';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LoadsRoutingModule,
    LoadListComponent,
    LoadCreateComponent
  ]
})
export class LoadsModule { }
