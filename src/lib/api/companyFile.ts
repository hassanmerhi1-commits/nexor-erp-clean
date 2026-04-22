/**
 * NEXOR ERP — Company File (.nexor) API client
 *
 * The .nexor file IS the company. One file per branch / per company.
 * This client talks to /api/company-file on the local backend.
 */

import { getApiUrl } from './config';

export interface CompanyFileMeta {
  filename: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
}

export interface CompanyFileInfo {
  directory: string;
  readOnlyMode: boolean;
  activeSnapshot: string | null;
  database: string;
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

export async function getCompanyFileInfo(): Promise<CompanyFileInfo> {
  const res = await fetch(`${getApiUrl()}/api/company-file/info`, {
    headers: authHeaders(),
  });
  return unwrap<CompanyFileInfo>(res);
}

export async function listCompanyFiles(): Promise<CompanyFileMeta[]> {
  const res = await fetch(`${getApiUrl()}/api/company-file`, {
    headers: authHeaders(),
  });
  return unwrap<CompanyFileMeta[]>(res);
}

export async function exportCompanyFile(branchLabel: string): Promise<{
  filename: string;
  size: number;
  path: string;
}> {
  const res = await fetch(`${getApiUrl()}/api/company-file/export`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ branchLabel }),
  });
  return unwrap(res);
}

export async function deleteCompanyFile(filename: string): Promise<void> {
  const res = await fetch(
    `${getApiUrl()}/api/company-file/${encodeURIComponent(filename)}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  await unwrap(res);
}

export async function downloadCompanyFile(filename: string): Promise<void> {
  const url = `${getApiUrl()}/api/company-file/download/${encodeURIComponent(
    filename,
  )}`;
  // Use a temporary anchor — keeps file streaming server-side.
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function restoreCompanyFile(filename: string): Promise<void> {
  const res = await fetch(
    `${getApiUrl()}/api/company-file/restore/${encodeURIComponent(filename)}`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        confirm: 'I UNDERSTAND THIS REPLACES ALL DATA',
      }),
    },
  );
  await unwrap(res);
}

/** Friendly file size formatter used by the Settings UI. */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}