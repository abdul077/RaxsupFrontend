import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LayoutComponent } from './components/layout/layout';
import { NavbarComponent } from './components/navbar/navbar';
import { SidebarComponent } from './components/sidebar/sidebar';
import { TopbarComponent } from './components/topbar/topbar';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule,
    LayoutComponent,
    NavbarComponent,
    SidebarComponent,
    TopbarComponent
  ],
  exports: [
    LayoutComponent,
    NavbarComponent,
    SidebarComponent,
    TopbarComponent
  ]
})
export class SharedModule { }
