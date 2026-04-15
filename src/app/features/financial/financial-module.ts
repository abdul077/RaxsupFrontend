import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FinancialRoutingModule } from './financial-routing-module';
import { InvoiceListComponent } from './invoice-list/invoice-list';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FinancialRoutingModule,
    InvoiceListComponent
  ]
})
export class FinancialModule { }
