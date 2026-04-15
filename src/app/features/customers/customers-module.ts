import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { CustomersRoutingModule } from './customers-routing-module';
import { CustomerListComponent } from './customer-list/customer-list';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CustomersRoutingModule,
    CustomerListComponent
  ]
})
export class CustomersModule { }
