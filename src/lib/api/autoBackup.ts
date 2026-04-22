/**
 * NEXOR ERP — Auto-Backup API client (Phase 4)
 *
 * Talks to /api/auto-backup on the local NEXOR backend.
 */
import { getApiUrl } from './config';

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

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('kwanza_auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getAutoBackupStatus(): Promise<AutoBackupStatus> {
  const res = await fetch(`${getApiUrl()}/api/auto-backup/status`, { headers: authHeaders() });
  return unwrap<AutoBackupStatus>(res);
}

export async function listAutoBackups(): Promise<AutoBackupSnapshot[]> {
  const res = await fetch(`${getApiUrl()}/api/auto-backup/list`, { headers: authHeaders() });
  return unwrap<AutoBackupSnapshot[]>(res);
}

export async function runAutoBackupNow(label?: string): Promise<{ success: boolean; file: AutoBackupSnapshot }> {
  const res = await fetch(`${getApiUrl()}/api/auto-backup/run`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ label }),
  });
  return unwrap(res);
}

export async function deleteAutoBackup(filename: string): Promise<void> {
  const res = await fetch(`${getApiUrl()}/api/auto-backup/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await unwrap(res);
}

export function downloadAutoBackup(filename: string): void {
  const url = `${getApiUrl()}/api/auto-backup/download/${encodeURIComponent(filename)}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
