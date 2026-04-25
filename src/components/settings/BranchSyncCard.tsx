import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  Loader2,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getBranchSyncInfo,
  listSyncFiles,
  exportDaySales,
  receiveSalesFromFile,
  receiveSalesFromEnvelope,
  downloadSyncFile,
  deleteSyncFile,
  formatBytes,
  type SyncFileMeta,
  type BranchSyncInfo,
  type ReceiveSalesResult,
} from '@/lib/api/branchSync';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * End-of-day branch sales exchange.
 *
 * - On the BRANCH PC: "Push Day's Sales" exports today's sales as
 *   a .dat file the cashier sends to head office (USB / email).
 * - On the HEAD OFFICE PC: "Receive Branch Sales" loads a .dat
 *   and runs each sale through the Transaction Engine, deducting
 *   stock and posting journals automatically.
 */
export function BranchSyncCard() {
  const [info, setInfo] = useState<BranchSyncInfo | null>(null);
  const [files, setFiles] = useState<SyncFileMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [receiving, setReceiving] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ReceiveSalesResult | null>(null);

  // Push form
  const [branchLabel, setBranchLabel] = useState('SOYO01');
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [force, setForce] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [i, list] = await Promise.all([getBranchSyncInfo(), listSyncFiles()]);
      setInfo(i);
      setFiles(list);
    } catch (e: any) {
      toast.error(`Failed to load branch sync: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handlePush() {
    if (!branchLabel.trim()) {
      toast.error('Enter a branch label first');
      return;
    }
    setPushing(true);
    try {
      const r = await exportDaySales({ branchLabel: branchLabel.trim(), from, to, force });
      if (r.count === 0) {
        toast.info('No sales to push for that window.', {
          description: 'All sales in this date range have already been pushed. Toggle "Re-export" to send them again.',
        });
      } else {
        toast.success(`${r.count} sales exported`, {
          description: `${r.filename} · ${formatBytes(r.size || 0)}`,
        });
      }
      await refresh();
    } catch (e: any) {
      toast.error(`Push failed: ${e.message}`);
    } finally {
      setPushing(false);
    }
  }

  async function handleReceiveFromFile(filename: string) {
    setReceiving(filename);
    setLastResult(null);
    try {
      const r = await receiveSalesFromFile(filename);
      setLastResult(r);
      toast.success(
        `${r.accepted} sales accepted from ${r.branchLabel ?? 'branch'}`,
        {
          description:
            (r.skippedDuplicate ? `${r.skippedDuplicate} duplicates skipped. ` : '') +
            (r.failed.length ? `${r.failed.length} failed.` : 'Stock updated, ledgers balanced.'),
        },
      );
      await refresh();
    } catch (e: any) {
      toast.error(`Receive failed: ${e.message}`);
    } finally {
      setReceiving(null);
    }
  }

  async function handleReceiveFromUpload(file: File) {
    setReceiving(file.name);
    setLastResult(null);
    try {
      const text = await file.text();
      const envelope = JSON.parse(text);
      const r = await receiveSalesFromEnvelope(envelope);
      setLastResult(r);
      toast.success(`${r.accepted} sales accepted`, {
        description:
          (r.skippedDuplicate ? `${r.skippedDuplicate} duplicates skipped. ` : '') +
          (r.failed.length ? `${r.failed.length} failed.` : 'Stock updated, ledgers balanced.'),
      });
      await refresh();
    } catch (e: any) {
      toast.error(`Receive failed: ${e.message}`);
    } finally {
      setReceiving(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Delete ${filename}?`)) return;
    try {
      await deleteSyncFile(filename);
      toast.success(`${filename} deleted`);
      await refresh();
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Sincronização de Filiais
            </CardTitle>
            <CardDescription>Troca diária de vendas por ficheiro `.dat`.</CardDescription>
          </div>
          {info?.readOnlyMode && (
            <Badge variant="outline" className="border-warning/60 text-warning">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Read-Only
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {info && (
          <div className="rounded-lg border bg-muted/40 p-3 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">Sync folder</span>
            <span className="font-mono truncate max-w-[260px]" title={info.directory}>
              {info.directory}
            </span>
          </div>
        )}

        {/* ---------- PUSH (branch PC) ---------- */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Filial: enviar vendas</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="branchLabel" className="text-xs">Branch label</Label>
              <Input
                id="branchLabel"
                value={branchLabel}
                onChange={(e) => setBranchLabel(e.target.value.toUpperCase())}
                placeholder="SOYO01"
                className="font-mono uppercase h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-xs">From</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to" className="text-xs">To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <Switch checked={force} onCheckedChange={setForce} />
              Reenviar vendas já exportadas
            </label>
            <Button onClick={handlePush} disabled={pushing || info?.readOnlyMode}>
              {pushing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A enviar...</>
              ) : (
                <><ArrowUpFromLine className="h-4 w-4 mr-2" /> Enviar vendas do dia</>
              )}
            </Button>
          </div>
        </section>

        <Separator />

        {/* ---------- RECEIVE (head office) ---------- */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Sede: receber vendas</h3>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".dat,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleReceiveFromUpload(f);
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!!receiving || info?.readOnlyMode}
            >
              <Upload className="h-4 w-4 mr-2" />
              Receber de ficheiro
            </Button>
            <span className="text-xs text-muted-foreground">Ou selecione um ficheiro da lista abaixo.</span>
          </div>

          {/* Last receive summary */}
          {lastResult && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">
                  {lastResult.accepted} accepted ·{' '}
                  {lastResult.skippedDuplicate} duplicates ·{' '}
                  {lastResult.failed.length} failed
                </span>
              </div>
              <div className="text-muted-foreground">
                Total: {lastResult.totalAmount.toLocaleString()} AOA
                {lastResult.branchLabel ? ` · from ${lastResult.branchLabel}` : ''}
              </div>
              {lastResult.failed.length > 0 && (
                <ul className="mt-1 pl-4 list-disc text-destructive space-y-0.5">
                  {lastResult.failed.slice(0, 5).map((f, i) => (
                    <li key={i}>
                      <span className="font-mono">{f.invoiceNumber || f.syncUuid?.slice(0, 8)}</span>: {f.error}
                    </li>
                  ))}
                  {lastResult.failed.length > 5 && (
                    <li>…and {lastResult.failed.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </section>

        <Separator />

        {/* ---------- LIST ---------- */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Ficheiros de sincronização</Label>
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
              <FileText className="h-6 w-6 mx-auto mb-2 opacity-50" />
              No .dat files yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
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
                      onClick={() => downloadSyncFile(f.filename)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Receive into this database"
                      disabled={!!receiving || info?.readOnlyMode}
                      onClick={() => handleReceiveFromFile(f.filename)}
                    >
                      {receiving === f.filename ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowDownToLine className="h-4 w-4" />
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
        </section>
      </CardContent>
    </Card>
  );
}

// Help tree-shakers
export const __unused = XCircle;