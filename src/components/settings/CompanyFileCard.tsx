import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Database,
  FileDown,
  FileText,
  Loader2,
  Trash2,
  Download,
  RotateCcw,
  ShieldAlert,
  FolderOpen,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  listCompanyFiles,
  exportCompanyFile,
  deleteCompanyFile,
  downloadCompanyFile,
  restoreCompanyFile,
  getCompanyFileInfo,
  mountReadOnlySnapshot,
  unmountReadOnlySnapshot,
  formatBytes,
  type CompanyFileMeta,
  type CompanyFileInfo,
} from '@/lib/api/companyFile';

/**
 * Settings card for managing the .nexor company file:
 *  - Export full snapshot
 *  - List existing snapshots
 *  - Download / delete a snapshot
 *  - Restore a snapshot (destructive, double-confirmed)
 */
export function CompanyFileCard() {
  const [info, setInfo] = useState<CompanyFileInfo | null>(null);
  const [files, setFiles] = useState<CompanyFileMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [branchLabel, setBranchLabel] = useState('SOYO');

  // Restore confirmation dialog state
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [mounting, setMounting] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [i, list] = await Promise.all([
        getCompanyFileInfo(),
        listCompanyFiles(),
      ]);
      setInfo(i);
      setFiles(list);
    } catch (e: any) {
      toast.error(`Failed to load company files: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleExport() {
    if (!branchLabel.trim()) {
      toast.error('Enter a branch / company label first');
      return;
    }
    setExporting(true);
    try {
      const r = await exportCompanyFile(branchLabel.trim());
      toast.success(
        `${r.filename} exported (${formatBytes(r.size)})`,
        { description: 'Saved in the company-files folder.' },
      );
      await refresh();
    } catch (e: any) {
      toast.error(`Export failed: ${e.message}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Delete ${filename}? This cannot be undone.`)) return;
    try {
      await deleteCompanyFile(filename);
      toast.success(`${filename} deleted`);
      await refresh();
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    }
  }

  async function handleDownload(filename: string) {
    try {
      await downloadCompanyFile(filename);
    } catch (e: any) {
      toast.error(`Download failed: ${e.message}`);
    }
  }

  async function handleMountReadOnly(filename: string) {
    if (!confirm(
      `Open ${filename} as a READ-ONLY snapshot?\n\n` +
      `The app will browse this file instead of the live database. ` +
      `No changes can be saved until you exit Traveler Mode.`
    )) return;
    setMounting(filename);
    try {
      await mountReadOnlySnapshot(filename);
      toast.success(`Traveler Mode active — viewing ${filename}`, {
        description: 'The app is now read-only. Use the banner to exit.',
      });
      // Reload so cached app state reflects the snapshot
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      toast.error(`Failed to open snapshot: ${e.message}`);
      setMounting(null);
    }
  }

  async function handleUnmountReadOnly() {
    setMounting('__unmount__');
    try {
      await unmountReadOnlySnapshot();
      toast.success('Live database restored');
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      toast.error(`Failed to exit traveler mode: ${e.message}`);
      setMounting(null);
    }
  }

  async function handleConfirmRestore() {
    if (!restoreTarget) return;
    if (confirmText !== 'RESTORE') {
      toast.error('Type RESTORE to confirm');
      return;
    }
    setRestoring(restoreTarget);
    try {
      await restoreCompanyFile(restoreTarget);
      toast.success(`Restored from ${restoreTarget}`, {
        description: 'The application will reload.',
      });
      setRestoreTarget(null);
      setConfirmText('');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      toast.error(`Restore failed: ${e.message}`);
    } finally {
      setRestoring(null);
    }
  }

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Ficheiro da Empresa (.nexor)
              </CardTitle>
              <CardDescription>
                Exportar, descarregar ou restaurar a empresa num ficheiro unico.
              </CardDescription>
            </div>
            {info?.readOnlyMode && (
              <Badge variant="outline" className="border-warning/60 text-warning">
                <ShieldAlert className="h-3 w-3 mr-1" />
                Read-Only Snapshot
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {info?.readOnlyMode && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 flex items-start justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium flex items-center gap-1.5">
                  <Eye className="h-4 w-4" /> Traveler Mode active
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Viewing snapshot{' '}
                  <span className="font-mono">{info.activeSnapshot || '—'}</span>.
                  All write actions are disabled.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUnmountReadOnly}
                disabled={mounting === '__unmount__'}
              >
                {mounting === '__unmount__' ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                )}
                Exit Traveler Mode
              </Button>
            </div>
          )}

          {/* Active database info */}
          {info && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active database</span>
                <span className="font-mono">{info.database}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Files folder</span>
                <span className="font-mono truncate max-w-[260px]" title={info.directory}>
                  {info.directory}
                </span>
              </div>
            </div>
          )}

          {/* Export */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="branchLabel" className="text-sm font-medium">
                Etiqueta da filial/empresa
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Usado como prefixo do ficheiro — ex.: <span className="font-mono">SOYO</span> →{' '}
                <span className="font-mono">SOYO-2026-04-22.nexor</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                id="branchLabel"
                value={branchLabel}
                onChange={(e) => setBranchLabel(e.target.value.toUpperCase())}
                placeholder="SOYO"
                className="font-mono uppercase"
                disabled={info?.readOnlyMode}
              />
              <Button onClick={handleExport} disabled={exporting || info?.readOnlyMode}>
                {exporting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A exportar...</>
                ) : (
                  <><FileDown className="h-4 w-4 mr-2" /> Exportar agora</>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Snapshots existentes</Label>
              <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
              </Button>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Loading…
              </div>
            ) : files.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
                <FolderOpen className="h-6 w-6 mx-auto mb-2 opacity-50" />
                No .nexor files yet. Export one above.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                {files.map((f) => (
                  <div
                    key={f.filename}
                    className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 hover:bg-accent/40 transition"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-mono truncate">{f.filename}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatBytes(f.size)} · {new Date(f.modifiedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Download"
                        onClick={() => handleDownload(f.filename)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Open as Read-Only (Traveler Mode)"
                        disabled={info?.readOnlyMode || mounting === f.filename}
                        onClick={() => handleMountReadOnly(f.filename)}
                      >
                        {mounting === f.filename ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Restore"
                        disabled={info?.readOnlyMode || restoring === f.filename}
                        onClick={() => {
                          setRestoreTarget(f.filename);
                          setConfirmText('');
                        }}
                      >
                        {restoring === f.filename ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete"
                        disabled={info?.readOnlyMode}
                        onClick={() => handleDelete(f.filename)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Restore confirmation dialog */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Restore {restoreTarget}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>replace ALL current data</strong> in{' '}
              <span className="font-mono">{info?.database}</span> with the contents of this snapshot. Recent transactions not present in the snapshot will be lost.
              <br /><br />
              Type <span className="font-mono font-bold">RESTORE</span> below to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type RESTORE"
            className="font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              disabled={confirmText !== 'RESTORE'}
              className="bg-destructive hover:bg-destructive/90"
            >
              Restore now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}