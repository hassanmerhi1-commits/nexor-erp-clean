/**
 * Shared Database Helper — single source of truth for Electron mode detection
 * and database operations. All storage modules import from here.
 */

export function isElectronMode(): boolean {
  return !!window.electronAPI?.isElectron && !!window.electronAPI?.db;
}

export async function dbGetAll<T>(table: string): Promise<T[]> {
  if (!isElectronMode()) return [];
  try {
    const result = await window.electronAPI!.db.getAll(table);
    return (result.data || []) as T[];
  } catch (e) {
    console.error(`[DB] getAll(${table}) error:`, e);
    return [];
  }
}

export async function dbInsert(table: string, data: Record<string, any>): Promise<boolean> {
  if (!isElectronMode()) return false;
  try {
    const result = await window.electronAPI!.db.insert(table, data);
    return result.success;
  } catch (e) {
    console.error(`[DB] insert(${table}) error:`, e);
    return false;
  }
}

export async function dbUpdate(table: string, id: string, data: Record<string, any>): Promise<boolean> {
  if (!isElectronMode()) return false;
  try {
    const result = await window.electronAPI!.db.update(table, id, data);
    return result.success;
  } catch (e) {
    console.error(`[DB] update(${table}) error:`, e);
    return false;
  }
}

export async function dbDelete(table: string, id: string): Promise<boolean> {
  if (!isElectronMode()) return false;
  try {
    const result = await window.electronAPI!.db.delete(table, id);
    return result.success;
  } catch (e) {
    console.error(`[DB] delete(${table}) error:`, e);
    return false;
  }
}

export async function dbQuery(sql: string, params: any[] = []): Promise<any[]> {
  if (!isElectronMode()) return [];
  try {
    const result = await window.electronAPI!.db.query(sql, params);
    return Array.isArray(result?.data) ? result.data : [];
  } catch (e) {
    console.error(`[DB] query error:`, e);
    return [];
  }
}

// localStorage helpers
export function lsGet<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function lsSet<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}
