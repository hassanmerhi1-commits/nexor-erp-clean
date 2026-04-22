// Audit Trail Service — records system events
// DUAL-MODE: Electron → SQLite audit_logs | Web → localStorage

import { isElectronMode, dbGetAll, dbInsert, lsGet } from '@/lib/dbHelper';

export interface AuditEntry {
  id: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'approve' | 'reject' | 'void' | 'print' | 'export' | 'login' | 'logout' | 'restore' | 'transfer';
  module: string;
  description: string;
  userName: string;
  userId: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

const AUDIT_KEY = 'kwanzaerp_audit_trail';
const MAX_ENTRIES = 5000;

export async function getAuditLog(): Promise<AuditEntry[]> {
  if (isElectronMode()) {
    const rows = await dbGetAll<any>('audit_logs');
    return rows.map(r => ({
      id: r.id,
      action: r.action || 'create',
      module: r.entity_type || '',
      description: r.new_value || r.previous_value || '',
      userName: r.user_name || '',
      userId: r.user_id || '',
      createdAt: r.timestamp || r.created_at || '',
    }));
  }
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch { return []; }
}

export function auditLog(
  action: AuditEntry['action'],
  module: string,
  description: string,
  userName = 'Sistema',
  userId = '',
  details?: Record<string, unknown>,
) {
  if (isElectronMode()) {
    // In Electron mode, the main process audit middleware handles this via dbInsert
    // But we also write explicitly for manual audit entries
    const id = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    dbInsert('audit_logs', {
      id,
      action,
      entity_type: module,
      entity_id: '',
      user_id: userId,
      user_name: userName,
      new_value: description,
      previous_value: details ? JSON.stringify(details) : '',
      timestamp: new Date().toISOString(),
    }).catch(() => {});
    return;
  }
  const entries = lsGet<AuditEntry[]>(AUDIT_KEY, []);
  entries.unshift({
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action,
    module,
    description,
    userName,
    userId,
    details,
    createdAt: new Date().toISOString(),
  });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
}
