export interface MotiveStatus {
  configured: boolean;
  baseUrl: string;
  webhooksEnabled: boolean;
}

export interface MotiveWebhookCounts {
  pending: number;
  processing: number;
  processed: number;
  failed: number;
}

export interface MotiveLastSync {
  syncLogId: number;
  entityType: string;
  syncType: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  recordsProcessed?: number | null;
  recordsFailed?: number | null;
  errorMessage?: string | null;
}

export interface MotiveLastWebhook {
  webhookEventId: number;
  eventType: string;
  status: string;
  receivedAt: string;
  processedAt?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  retryCount: number;
  processingError?: string | null;
}

export interface MotiveLastFailure {
  kind: string;
  id: string;
  entityType?: string | null;
  action?: string | null;
  status: string;
  at: string;
  error?: string | null;
}

export interface MotiveSummary {
  configured: boolean;
  baseUrl: string;
  webhooksEnabled: boolean;
  lastSync?: MotiveLastSync | null;
  lastFailure?: MotiveLastFailure | null;
  webhookCounts: MotiveWebhookCounts;
  lastWebhook?: MotiveLastWebhook | null;
}

export interface MotiveSyncLog {
  syncLogId: number;
  entityType: string;
  entityId?: number | null;
  syncType: string;
  status: string;
  recordsProcessed?: number | null;
  recordsFailed?: number | null;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  rawResponse?: string | null;
}

export interface MotiveWebhookEvent {
  webhookEventId: number;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payloadLength?: number;
  payloadPreview?: string;
  status: string;
  processingError?: string | null;
  retryCount: number;
  receivedAt: string;
  processedAt?: string | null;
}

export interface MotiveExternalIdMapping {
  mappingId: number;
  entityType: string;
  internalId?: number | null;
  motiveId?: string | null;
  externalId?: string | null;
  syncDirection: string;
  createdAt: string;
  lastSyncedAt?: string | null;
  syncStatus?: string | null;
}

