/**
 * NEXOR ERP — Branch Sync (Push / Receive Sales) API client
 */

import { getApiUrl } from './config';

export interface SyncFileMeta {
  filename: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
}

export interface BranchSyncInfo {
  directory: string;
  envelopeVersion: number;
  readOnlyMode: boolean;
}

export interface ExportSalesResult {
  success: true;
  filename?: string;
  size?: number;
  path?: string;
  count: number;
  windowFrom?: string;
  windowTo?: string;
  branchLabel?: string;
  message?: string;
}

export interface ReceiveSalesResult {
  success: true;
  branchLabel?: string;
  windowFrom?: string;
  windowTo?: string;
  sourceFile?: string | null;
  accepted: number;
  skippedDuplicate: number;
  totalAmount: number;
  failed: Array<{ invoiceNumber?: string; syncUuid?: string; error: string }>;
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
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getBranchSyncInfo(): Promise<BranchSyncInfo> {
  return unwrap(await fetch(`${getApiUrl()}/api/branch-sync/info`, { headers: authHeaders() }));
}

export async function listSyncFiles(): Promise<SyncFileMeta[]> {
  return unwrap(await fetch(`${getApiUrl()}/api/branch-sync`, { headers: authHeaders() }));
}

export async function exportDaySales(opts: {
  branchLabel: string;
  from?: string;
  to?: string;
  force?: boolean;
}): Promise<ExportSalesResult> {
  const res = await fetch(`${getApiUrl()}/api/branch-sync/export-sales`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(opts),
  });
  return unwrap(res);
}

/** Process a .dat file already sitting in the BranchSync folder. */
export async function receiveSalesFromFile(filename: string): Promise<ReceiveSalesResult> {
  const res = await fetch(`${getApiUrl()}/api/branch-sync/receive-sales`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ filename }),
  });
  return unwrap(res);
}

/** Process an envelope uploaded by the user (USB / email attachment). */
export async function receiveSalesFromEnvelope(envelope: unknown): Promise<ReceiveSalesResult> {
  const res = await fetch(`${getApiUrl()}/api/branch-sync/receive-sales`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ envelope }),
  });
  return unwrap(res);
}

export async function downloadSyncFile(filename: string): Promise<void> {
  const a = document.createElement('a');
  a.href = `${getApiUrl()}/api/branch-sync/download/${encodeURIComponent(filename)}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function deleteSyncFile(filename: string): Promise<void> {
  await unwrap(
    await fetch(`${getApiUrl()}/api/branch-sync/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }),
  );
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}