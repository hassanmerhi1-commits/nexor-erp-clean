import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Loader2,
  PlayCircle,
  Download,
  Trash2,
  Clock,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getAutoBackupStatus,
  listAutoBackups,
  runAutoBackupNow,
  deleteAutoBackup,
  downloadAutoBackup,
  formatBytes,
  type AutoBackupStatus,
  type AutoBackupSnapshot,
} from '@/lib/api/autoBackup';

/**
 * NEXOR ERP — Auto-Backup safety net (Phase 4)
 *
 * Shows scheduler status + lets the operator trigger a manual snapshot,
 * download or remove existing snapshots. Runs entirely on the local backend
 * (pg_dump → C:\NEXOR\AutoBackups).
 */
export function AutoBackupCard() {
  const [status, setStatus] = useState<AutoBackupStatus | null>(null);
  const [snapshots, setSnapshots] = useState<AutoBackupSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [s, list] = await Promise.all([getAutoBackupStatus(), listAutoBackups()]);
      setStatus(s);
      setSnapshots(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load auto-backup status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  async function handleRun() {
    setRunning(true);
    try {
      await runAutoBackupNow();
      toast.success('Backup created');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backup failed');
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Delete ${filename}?`)) return;
    try {
      await deleteAutoBackup(filename);
      toast.success('Snapshot deleted');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function fmtDate(iso: string | null) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Auto-Backup Safety Net
            </CardTitle>
            <CardDescription>
              Scheduled PostgreSQL snapshots. Survive crashes, disk loss, or accidental deletes.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Status grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground mb-1">Scheduler</div>
            <div className="flex items-center gap-2">
              {status?.enabled ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium">Active</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="font-medium">Disabled</span>
                </>
              )}
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Interval
            </div>
            <div className="font-medium font-mono">
              {status ? `${status.intervalHours}h` : '—'}
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground mb-1">Snapshots</div>
            <div className="font-medium">
              {status?.snapshots ?? 0}
              <span className="text-muted-foreground"> / {status?.retention ?? '—'}</span>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground mb-1">Next run</div>
            <div className="font-mono text-xs">{fmtDate(status?.nextRunAt ?? null)}</div>
          </div>
        </div>

        {/* Last run */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground mb-1">Last success</div>
            <div className="font-mono text-xs">{fmtDate(status?.lastSuccessAt ?? null)}</div>
            {status?.lastFile && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {status.lastFile.filename} · {formatBytes(status.lastFile.size)}
              </div>
            )}
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground mb-1">Last attempt</div>
            <div className="font-mono text-xs">{fmtDate(status?.lastRunAt ?? null)}</div>
            {status?.lastError && (
              <div className="text-xs text-destructive mt-1 truncate" title={status.lastError}>
                {status.lastError}
              </div>
            )}
          </div>
        </div>

        {status?.dir && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FolderOpen className="h-3 w-3" />
            <span className="font-mono truncate">{status.dir}</span>
          </div>
        )}

        <Separator />

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleRun} disabled={running || status?.running}>
            {running || status?.running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Backing up…
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Run backup now
              </>
            )}
          </Button>
          <Badge variant="secondary" className="font-mono">
            pg_dump · plain SQL
          </Badge>
        </div>

        {/* Snapshot list */}
        <Separator />
        <div>
          <div className="text-sm font-medium mb-2">Available snapshots</div>
          {snapshots.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              No snapshots yet. The first run will appear here shortly after boot.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-auto pr-1">
              {snapshots.map((s) => (
                <div
                  key={s.filename}
                  className="flex items-center justify-between gap-2 rounded-md border bg-card p-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs truncate">{s.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(s.createdAt)} · {formatBytes(s.size)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadAutoBackup(s.filename)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(s.filename)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
