import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Shield, Search, FileText, User, Download, LogIn, LogOut, Edit,
  CheckCircle, XCircle, AlertTriangle, Printer, RefreshCw, ArrowRightLeft,
  Eye, Trash2, RotateCcw, Package, DollarSign, Clock
} from 'lucide-react';
import { getAuditLog, auditLog as recordAudit, type AuditEntry } from '@/lib/auditService';
import { toast } from 'sonner';

const ACTION_CONFIG: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  create: { icon: FileText, label: 'Criação', color: 'text-green-600' },
  update: { icon: Edit, label: 'Alteração', color: 'text-blue-600' },
  delete: { icon: XCircle, label: 'Eliminação', color: 'text-destructive' },
  status_change: { icon: AlertTriangle, label: 'Mudança Estado', color: 'text-amber-600' },
  approve: { icon: CheckCircle, label: 'Aprovação', color: 'text-green-600' },
  reject: { icon: XCircle, label: 'Rejeição', color: 'text-destructive' },
  void: { icon: XCircle, label: 'Anulação', color: 'text-destructive' },
  print: { icon: Printer, label: 'Impressão', color: 'text-muted-foreground' },
  export: { icon: Download, label: 'Exportação', color: 'text-muted-foreground' },
  login: { icon: LogIn, label: 'Login', color: 'text-green-600' },
  logout: { icon: LogOut, label: 'Logout', color: 'text-muted-foreground' },
  restore: { icon: RotateCcw, label: 'Restauro', color: 'text-amber-600' },
  transfer: { icon: ArrowRightLeft, label: 'Transferência', color: 'text-blue-600' },
};

const MODULE_LABELS: Record<string, string> = {
  sales: 'Vendas', products: 'Produtos', clients: 'Clientes', suppliers: 'Fornecedores',
  purchase_orders: 'Ord. Compra', purchase_invoices: 'Fact. Compra', payments: 'Pagamentos',
  stock: 'Stock', hr: 'RH', production: 'Produção', accounting: 'Contabilidade',
  system: 'Sistema', users: 'Utilizadores', invoices: 'Facturas', backup: 'Backup',
  fiscal: 'Fiscal', expenses: 'Despesas', bank: 'Banco',
};

// Seed demo data if audit log is empty
async function ensureDemoData() {
  const existing = await getAuditLog();
  if (existing.length > 0) return;

  const demos: Omit<AuditEntry, 'id' | 'createdAt'>[] = [
    { action: 'create', module: 'sales', description: 'Venda FT SEDE/20260331/0001 criada - 45.000 Kz', userName: 'Admin', userId: '1' },
    { action: 'update', module: 'products', description: 'Produto "Arroz 25kg" - preço alterado de 3.500 para 3.800 Kz', userName: 'Admin', userId: '1' },
    { action: 'approve', module: 'purchase_orders', description: 'OC-20260331-0003 aprovada - 1.200.000 Kz', userName: 'Director', userId: '2' },
    { action: 'void', module: 'invoices', description: 'Factura FT SEDE/20260330/0012 anulada - erro de cliente', userName: 'Admin', userId: '1' },
    { action: 'login', module: 'system', description: 'Login no terminal POS - Filial Sede', userName: 'Operador1', userId: '3' },
    { action: 'create', module: 'stock', description: 'Ajuste de stock: Óleo Fula 5L - entrada +50 unidades', userName: 'Admin', userId: '1' },
    { action: 'create', module: 'payments', description: 'Recebimento REC202603310001 - Cliente ABC - 120.000 Kz', userName: 'Admin', userId: '1' },
    { action: 'delete', module: 'products', description: 'Produto "Teste" eliminado do catálogo', userName: 'Admin', userId: '1' },
    { action: 'create', module: 'accounting', description: 'Lançamento VD202603310001 - Venda automática', userName: 'Sistema', userId: '' },
    { action: 'status_change', module: 'accounting', description: 'Período Fevereiro 2026 fechado', userName: 'Director', userId: '2' },
    { action: 'export', module: 'fiscal', description: 'Ficheiro SAF-T exportado - período Q1 2026', userName: 'Admin', userId: '1' },
    { action: 'create', module: 'hr', description: 'Funcionário João Silva adicionado - Dept. Vendas', userName: 'Admin', userId: '1' },
    { action: 'transfer', module: 'stock', description: 'Transferência: 100x Arroz 25kg - Sede → Filial Viana', userName: 'Admin', userId: '1' },
    { action: 'create', module: 'expenses', description: 'Despesa registada: Electricidade - 85.000 Kz', userName: 'Admin', userId: '1' },
    { action: 'update', module: 'bank', description: 'Reconciliação bancária - BAI conta 0040 - 15 movimentos', userName: 'Director', userId: '2' },
  ];

  for (const d of demos) {
    await recordAudit(d.action, d.module, d.description, d.userName, d.userId);
  }
}

export default function AuditTrail() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterModule, setFilterModule] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  // Seed demo data and load on mount
  useEffect(() => {
    ensureDemoData().then(() => getAuditLog()).then(setAuditEntries);
  }, [refreshKey]);

  const filtered = useMemo(() => {
    return auditEntries.filter(entry => {
      if (filterAction !== 'all' && entry.action !== filterAction) return false;
      if (filterModule !== 'all' && entry.module !== filterModule) return false;
      if (filterUser !== 'all' && entry.userName !== filterUser) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return entry.description?.toLowerCase().includes(q) ||
               entry.userName?.toLowerCase().includes(q) ||
               entry.module?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [auditEntries, filterAction, filterModule, filterUser, searchTerm]);

  const uniqueModules = useMemo(() => [...new Set(auditEntries.map(e => e.module))].sort(), [auditEntries]);
  const uniqueUsers = useMemo(() => [...new Set(auditEntries.map(e => e.userName))].sort(), [auditEntries]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayEntries = auditEntries.filter(e => new Date(e.createdAt).toDateString() === today);
    return {
      total: auditEntries.length,
      today: todayEntries.length,
      creates: auditEntries.filter(e => e.action === 'create').length,
      updates: auditEntries.filter(e => e.action === 'update').length,
      deletes: auditEntries.filter(e => e.action === 'delete' || e.action === 'void').length,
      logins: auditEntries.filter(e => e.action === 'login').length,
    };
  }, [auditEntries]);

  // Group by date for timeline
  const groupedByDate = useMemo(() => {
    const groups: Record<string, AuditEntry[]> = {};
    filtered.forEach(entry => {
      const dateKey = new Date(entry.createdAt).toLocaleDateString('pt-AO');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    });
    return Object.entries(groups);
  }, [filtered]);

  const exportAudit = () => {
    const json = JSON.stringify(auditEntries, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    recordAudit('export', 'system', 'Trilha de auditoria exportada', 'Admin', '');
    toast.success('Auditoria exportada');
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5" /> Trilha de Auditoria
            </h1>
            <p className="text-sm text-muted-foreground">Registo completo de todas as operações — AGT Compliance</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey(k => k + 1)}>
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportAudit}>
              <Download className="w-3.5 h-3.5" /> Exportar
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-2 px-4 pt-3">
        {[
          { label: 'Total', value: stats.total, icon: Shield },
          { label: 'Hoje', value: stats.today, icon: Clock },
          { label: 'Criações', value: stats.creates, icon: FileText },
          { label: 'Alterações', value: stats.updates, icon: Edit },
          { label: 'Anulações', value: stats.deletes, icon: XCircle },
          { label: 'Logins', value: stats.logins, icon: LogIn },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="py-2 px-3 flex items-center gap-2">
              <s.icon className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-8 text-sm pl-8" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Acção" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Acções</SelectItem>
            {Object.entries(ACTION_CONFIG).map(([key, c]) => (
              <SelectItem key={key} value={key}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterModule} onValueChange={setFilterModule}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Módulo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Módulos</SelectItem>
            {uniqueModules.map(m => (
              <SelectItem key={m as string} value={m as string}>{MODULE_LABELS[m as string] || m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Utilizador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Utilizadores</SelectItem>
            {uniqueUsers.map(u => (
              <SelectItem key={u as string} value={u as string}>{u as string}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-[10px] ml-auto">{filtered.length} resultados</Badge>
      </div>

      {/* Timeline Table */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {groupedByDate.map(([date, entries]) => (
          <div key={date} className="mb-4">
            <div className="flex items-center gap-2 mb-1.5 sticky top-0 bg-background z-10 py-1">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">{date}</span>
              <Badge variant="secondary" className="text-[9px]">{entries.length}</Badge>
              <Separator className="flex-1" />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Hora</TableHead>
                  <TableHead className="w-24">Acção</TableHead>
                  <TableHead className="w-28">Módulo</TableHead>
                  <TableHead className="w-24">Utilizador</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => {
                  const config = ACTION_CONFIG[entry.action] || { icon: FileText, label: entry.action, color: 'text-muted-foreground' };
                  const Icon = config.icon;
                  return (
                    <TableRow key={entry.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedEntry(entry)}>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                          <span className="text-xs">{config.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{MODULE_LABELS[entry.module] || entry.module}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-muted-foreground" />
                          {entry.userName}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{entry.description}</TableCell>
                      <TableCell>
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum registo encontrado</p>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" /> Detalhes do Registo
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground text-xs">ID:</span><p className="font-mono text-xs">{selectedEntry.id}</p></div>
                <div><span className="text-muted-foreground text-xs">Data/Hora:</span><p className="text-xs">{new Date(selectedEntry.createdAt).toLocaleString('pt-AO')}</p></div>
                <div><span className="text-muted-foreground text-xs">Acção:</span>
                  <Badge className="text-[10px] mt-0.5">{ACTION_CONFIG[selectedEntry.action]?.label || selectedEntry.action}</Badge>
                </div>
                <div><span className="text-muted-foreground text-xs">Módulo:</span>
                  <Badge variant="outline" className="text-[10px] mt-0.5">{MODULE_LABELS[selectedEntry.module] || selectedEntry.module}</Badge>
                </div>
                <div><span className="text-muted-foreground text-xs">Utilizador:</span><p className="text-xs">{selectedEntry.userName}</p></div>
                <div><span className="text-muted-foreground text-xs">User ID:</span><p className="font-mono text-xs">{selectedEntry.userId || '-'}</p></div>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground text-xs">Descrição:</span>
                <p className="text-sm mt-1">{selectedEntry.description}</p>
              </div>
              {selectedEntry.details && (
                <>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground text-xs">Dados Adicionais:</span>
                    <pre className="text-[10px] bg-muted/50 p-2 rounded mt-1 overflow-auto max-h-40 font-mono">
                      {JSON.stringify(selectedEntry.details, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
