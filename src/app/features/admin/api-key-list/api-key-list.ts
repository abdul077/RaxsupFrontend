import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ApiKey, CreateApiKeyRequest } from '../../../core/models/admin.model';

@Component({
  selector: 'app-api-key-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './api-key-list.html',
  styleUrl: './api-key-list.scss',
})
export class ApiKeyListComponent implements OnInit {
  apiKeys: ApiKey[] = [];
  loading = false;
  showCreateModal = false;
  newApiKey: CreateApiKeyRequest = { keyName: '' };
  createdKey: string | null = null;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadApiKeys();
  }

  loadApiKeys(): void {
    this.loading = true;
    this.adminService.getApiKeys().subscribe({
      next: (data) => {
        this.apiKeys = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  createApiKey(): void {
    this.adminService.createApiKey(this.newApiKey).subscribe({
      next: (result) => {
        this.createdKey = result.apiKeyValue;
        this.showCreateModal = false;
        this.newApiKey = { keyName: '' };
        this.loadApiKeys();
      }
    });
  }

  toggleActive(apiKey: ApiKey): void {
    this.adminService.updateApiKey(apiKey.apiKeyId, { isActive: !apiKey.isActive }).subscribe({
      next: () => {
        this.loadApiKeys();
      }
    });
  }
}

