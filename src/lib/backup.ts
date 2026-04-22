/**
 * Backup & Restore for Kwanza ERP
 * Exports/imports all localStorage data as JSON
 */

const ERP_PREFIX = 'kwanza';

export interface BackupMetadata {
  version: string;
  createdAt: string;
  itemCount: number;
  sizeBytes: number;
  branchName?: string;
}

export interface BackupPackage {
  metadata: BackupMetadata;
  data: Record<string, string>;
}

export function createBackup(): BackupPackage {
  const data: Record<string, string> = {};
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(ERP_PREFIX)) {
      data[key] = localStorage.getItem(key) || '';
    }
  }

  const json = JSON.stringify(data);
  
  const metadata: BackupMetadata = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    itemCount: Object.keys(data).length,
    sizeBytes: new Blob([json]).size,
    branchName: (() => {
      try {
        const branch = localStorage.getItem('kwanzaerp_current_branch');
        return branch ? JSON.parse(branch)?.name : undefined;
      } catch { return undefined; }
    })(),
  };

  return { metadata, data };
}

export function downloadBackup(): void {
  const backup = createBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const date = new Date().toISOString().slice(0, 10);
  const filename = `kwanza-backup-${date}.json`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseBackupFile(file: File): Promise<BackupPackage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!parsed.metadata || !parsed.data) {
          reject(new Error('Formato de backup inválido'));
          return;
        }
        resolve(parsed as BackupPackage);
      } catch {
        reject(new Error('Ficheiro JSON inválido'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler ficheiro'));
    reader.readAsText(file);
  });
}

export function restoreBackup(backup: BackupPackage, clearExisting = true): number {
  if (clearExisting) {
    // Only clear kwanza keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(ERP_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }

  let count = 0;
  for (const [key, value] of Object.entries(backup.data)) {
    localStorage.setItem(key, value);
    count++;
  }
  return count;
}

export function getStorageStats(): { keys: number; sizeKB: number } {
  let size = 0;
  let keys = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(ERP_PREFIX)) {
      keys++;
      size += (localStorage.getItem(key) || '').length * 2; // UTF-16
    }
  }
  return { keys, sizeKB: Math.round(size / 1024) };
}
