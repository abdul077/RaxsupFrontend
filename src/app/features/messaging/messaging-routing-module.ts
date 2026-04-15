import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./chat-list/chat-list').then(m => m.ChatListComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./chat-window/chat-window').then(m => m.ChatWindowComponent)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MessagingRoutingModule { }

