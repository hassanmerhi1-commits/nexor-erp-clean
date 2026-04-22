/**
 * NEXOR ERP — Auto-Backup API client (Phase 4)
 */
import { apiClient } from './client';

export interface AutoBackupSnapshot {
  filename: string;
  size: number;
  createdAt: string;
}

export interface AutoBackupStatus {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastFile: AutoBackupSnapshot | null;
  nextRunAt: string | null;
  intervalHours: number;
  retention: number;
  dir: string;
  snapshots: number;
}

export const autoBackupAPI = {
  status: () => apiClient.get<AutoBackupStatus>('/auto-backup/status'),
  list: () => apiClient.get<AutoBackupSnapshot[]>('/auto-backup/list'),
  run: (label?: string) =>
    apiClient.post<{ success: boolean; file: AutoBackupSnapshot }>(
      '/auto-backup/run',
      { label }
    ),
  remove: (filename: string) =>
    apiClient.delete<{ success: boolean }>(
      `/auto-backup/${encodeURIComponent(filename)}`
    ),
  downloadUrl: (filename: string) =>
    `${apiClient.baseUrl}/auto-backup/download/${encodeURIComponent(filename)}`,
};
