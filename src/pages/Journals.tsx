import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useBranchContext } from '@/contexts/BranchContext';
import { useAuth } from '@/hooks/useERP';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus, Search, Edit2, Trash2, RefreshCw, FileText,
  Calendar, Eye, Printer, Download, CheckCircle, XCircle,
  Filter, ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Account } from '@/types/accounting';
import { api } from '@/lib/api/client';

const COA_STORAGE_KEY = 'kwanzaerp_chart_of_accounts';

function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(COA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// Mock journal entries for display types
interface DisplayEntry {
  id: string;
  entryNumber: string;
  date: string;
  type: string;
  currency: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  isPosted: boolean;
  createdBy: string;
  lines: { id: string; accountCode: string; accountName: string; description: string; debit: number; credit: number }[];
}

const ENTRY_TYPES = [
  { value: 'venda', label: 'Venda', color: 'text-blue-600' },
  { value: 'compra', label: 'Compra', color: 'text-orange-600' },
  { value: 'recibo', label: 'Recibo', color: 'text-green-600' },
  { value: 'pagamento', label: 'Pagamento', color: 'text-red-600' },
  { value: 'ajuste', label: 'Ajuste', color: 'text-purple-600' },
  { value: 'abertura', label: 'Abertura', color: 'text-muted-foreground' },
  { value: 'fecho', label: 'Fecho', color: 'text-muted-foreground' },
  { value: 'manual', label: 'Manual', color: 'text-amber-600' },
];

function useJournalEntries(branchId?: string) {
  const [entries, setEntries] = useState<DisplayEntry[]>([]);

  const loadAll = useCallback(async () => {
    const allEntries: DisplayEntry[] = [];

    try {
      // Fetch journal entries from API
      const response = await api.journalEntries.list({ branchId });
      const journalEntries = response.data || [];
      for (const je of journalEntries) {
        allEntries.push({
          id: je.id,
          entryNumber: je.entry_number || je.entryNumber,
          date: je.entry_date || je.entryDate || je.created_at || je.createdAt,
          type: je.reference_type || je.referenceType || 'manual',
          currency: 'AOA',
          description: je.description,
          totalDebit: Number(je.total_debit || je.totalDebit || 0),
          totalCredit: Number(je.total_credit || je.totalCredit || 0),
          isPosted: true,
          createdBy: je.created_by || je.createdBy || 'Sistema',
          lines: (je.lines || []).map((l: any) => ({
            id: `${je.id}_${l.account_code || l.accountCode}_${l.debit}_${l.credit}`,
            accountCode: l.account_code || l.accountCode || '',
            accountName: l.account_name || l.accountName || '',
            description: l.description || '',
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
          })),
        });
      }
    } catch {
      // Fallback: localStorage
      try {
        const raw = localStorage.getItem('kwanzaerp_journal_entries');
        const journalEntries = raw ? JSON.parse(raw) : [];
        for (const je of journalEntries) {
          if (branchId && je.branchId !== branchId) continue;
          allEntries.push({
            id: je.id,
            entryNumber: je.entryNumber,
            date: je.entryDate || je.createdAt,
            type: je.referenceType || 'manual',
            currency: 'AOA',
            description: je.description,
            totalDebit: je.totalDebit,
            totalCredit: je.totalCredit,
            isPosted: true,
            createdBy: je.createdBy || 'Sistema',
            lines: (je.lines || []).map((l: any) => ({
              id: `${je.id}_${l.accountCode}_${l.debit}_${l.credit}`,
              accountCode: l.accountCode || '',
              accountName: l.accountName || '',
              description: l.description || '',
              debit: l.debit,
              credit: l.credit,
            })),
          });
        }
      } catch { /* ignore */ }
    }

    if (!window.electronAPI?.isElectron) {
      try {
        const salesData = localStorage.getItem('kwanzaerp_sales');
        const sales = salesData ? JSON.parse(salesData) : [];
        const existingIds = new Set(allEntries.map(e => e.id));
        
        for (let idx = 0; idx < Math.min(sales.length, 50); idx++) {
          const sale = sales[idx];
          const id = `sale_je_${sale.id || idx}`;
          if (existingIds.has(id)) continue;
          
          allEntries.push({
            id,
            entryNumber: `VD-${String(idx + 1).padStart(4, '0')}`,
            date: sale.createdAt || new Date().toISOString(),
            type: 'venda',
            currency: 'AOA',
            description: `Venda ${sale.invoiceNumber || ''}`.trim(),
            totalDebit: sale.total || 0,
            totalCredit: sale.total || 0,
            isPosted: true,
            createdBy: sale.cashierName || 'Sistema',
            lines: [
              { id: `${id}_1`, accountCode: '4.1.1', accountName: 'Caixa', description: 'Recebimento', debit: sale.total || 0, credit: 0 },
              { id: `${id}_2`, accountCode: '7.1.1', accountName: 'Vendas de Mercadorias', description: sale.invoiceNumber || '', debit: 0, credit: (sale.subtotal || sale.total || 0) },
              ...(sale.taxAmount ? [{ id: `${id}_3`, accountCode: '2.4.3', accountName: 'IVA a Pagar', description: 'IVA', debit: 0, credit: sale.taxAmount }] : []),
            ],
          });
        }
      } catch { /* ignore */ }
    }

    allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEntries(allEntries);
  }, [branchId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  return { entries, refetch: loadAll };
}

// ============= NEW ENTRY LINE INTERFACE =============
interface NewEntryLine {
  id: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: string;
  credit: string;
}

function createEmptyLine(): NewEntryLine {
  return {
    id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    accountCode: '',
    accountName: '',
    description: '',
    debit: '',
    credit: '',
  };
}

export default function Journals() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentBranch } = useBranchContext();
  const { entries, refetch } = useJournalEntries(currentBranch?.id);

  const [activeTab, setActiveTab] = useState('diarios');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [viewEntryOpen, setViewEntryOpen] = useState(false);

  // New entry dialog state
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [newEntryDate, setNewEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEntryType, setNewEntryType] = useState('ajuste');
  const [newEntryDescription, setNewEntryDescription] = useState('');
  const [newEntryLines, setNewEntryLines] = useState<NewEntryLine[]>([createEmptyLine(), createEmptyLine()]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountSearch, setAccountSearch] = useState('');
  const [activeLineId, setActiveLineId] = useState<string | null>(null);

  // Load accounts for the picker
  useEffect(() => {
    if (newEntryOpen) {
      const accts = loadAccounts().filter(a => a.is_active && !a.is_header);
      setAccounts(accts);
    }
  }, [newEntryOpen]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchesSearch = !searchTerm ||
        e.entryNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || e.type === filterType;
      const matchesDateFrom = !dateFrom || e.date >= dateFrom;
      const matchesDateTo = !dateTo || e.date <= dateTo + 'T23:59:59';
      return matchesSearch && matchesType && matchesDateFrom && matchesDateTo;
    });
  }, [entries, searchTerm, filterType, dateFrom, dateTo]);

  // Totals
  const totals = useMemo(() => {
    return filteredEntries.reduce((acc, e) => ({
      debit: acc.debit + e.totalDebit,
      credit: acc.credit + e.totalCredit,
    }), { debit: 0, credit: 0 });
  }, [filteredEntries]);

  const selectedEntry = entries.find(e => e.id === selectedEntryId);

  // New entry line calculations
  const newEntryTotalDebit = newEntryLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const newEntryTotalCredit = newEntryLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(newEntryTotalDebit - newEntryTotalCredit) < 0.01;
  const difference = newEntryTotalDebit - newEntryTotalCredit;

  // Filtered accounts for picker
  const filteredAccounts = useMemo(() => {
    if (!accountSearch) return accounts.slice(0, 30);
    const term = accountSearch.toLowerCase();
    return accounts.filter(a => 
      a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term)
    ).slice(0, 30);
  }, [accounts, accountSearch]);

  // Reset new entry form
  function resetNewEntry() {
    setNewEntryDate(new Date().toISOString().split('T')[0]);
    setNewEntryType('ajuste');
    setNewEntryDescription('');
    setNewEntryLines([createEmptyLine(), createEmptyLine()]);
    setAccountSearch('');
    setActiveLineId(null);
  }

  function openNewEntry() {
    resetNewEntry();
    setNewEntryOpen(true);
  }

  function updateLine(lineId: string, field: keyof NewEntryLine, value: string) {
    setNewEntryLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const updated = { ...l, [field]: value };
      // When entering debit, clear credit and vice versa
      if (field === 'debit' && parseFloat(value) > 0) {
        updated.credit = '';
      } else if (field === 'credit' && parseFloat(value) > 0) {
        updated.debit = '';
      }
      return updated;
    }));
  }

  function selectAccount(lineId: string, account: Account) {
    setNewEntryLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      return { ...l, accountCode: account.code, accountName: account.name };
    }));
    setActiveLineId(null);
    setAccountSearch('');
  }

  function removeLine(lineId: string) {
    if (newEntryLines.length <= 2) {
      toast.error('O lançamento precisa de pelo menos 2 linhas');
      return;
    }
    setNewEntryLines(prev => prev.filter(l => l.id !== lineId));
  }

  function addLine() {
    setNewEntryLines(prev => [...prev, createEmptyLine()]);
  }

  // Auto-fill last line to balance
  function autoBalance() {
    if (newEntryLines.length < 2) return;
    const lastLine = newEntryLines[newEntryLines.length - 1];
    const otherLines = newEntryLines.slice(0, -1);
    const otherDebit = otherLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const otherCredit = otherLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    const diff = otherDebit - otherCredit;

    setNewEntryLines(prev => prev.map((l, i) => {
      if (i !== prev.length - 1) return l;
      if (diff > 0) {
        return { ...l, credit: diff.toFixed(2), debit: '' };
      } else if (diff < 0) {
        return { ...l, debit: Math.abs(diff).toFixed(2), credit: '' };
      }
      return l;
    }));
  }

  // Save journal entry
  async function saveNewEntry() {
    // Validate
    if (!newEntryDescription.trim()) {
      toast.error('Preencha a descrição do lançamento');
      return;
    }

    const validLines = newEntryLines.filter(l => l.accountCode && (parseFloat(l.debit) || parseFloat(l.credit)));
    if (validLines.length < 2) {
      toast.error('O lançamento precisa de pelo menos 2 linhas com conta e valor');
      return;
    }

    if (!isBalanced) {
      toast.error(`Lançamento não está balanceado. Diferença: ${Math.abs(difference).toLocaleString('pt-AO')} Kz`);
      return;
    }

    // Create journal entry via API
    let createdEntry: any;
    try {
      const lines = validLines.map((line) => ({
        accountCode: line.accountCode,
        accountName: line.accountName,
        description: line.description || newEntryDescription,
        debit: parseFloat(line.debit) || 0,
        credit: parseFloat(line.credit) || 0,
      }));
      
      const response = await api.transactions.process({
        type: 'manual_journal',
        description: newEntryDescription,
        referenceType: newEntryType,
        referenceId: `manual_${Date.now()}`,
        branchId: currentBranch?.id || '',
        entryDate: newEntryDate,
        createdBy: user?.name || 'Sistema',
        journalEntries: lines,
      });
      
      createdEntry = response.data || { entryNumber: `JE-${Date.now()}` };
    } catch {
      // Fallback: save to localStorage
      const entryNumber = `JE-${Date.now().toString().slice(-6)}`;
      createdEntry = { entryNumber };
      const entry = {
        id: `je_${Date.now()}`,
        entryNumber,
        description: newEntryDescription,
        referenceType: newEntryType,
        referenceId: `manual_${Date.now()}`,
        branchId: currentBranch?.id || '',
        entryDate: newEntryDate,
        createdBy: user?.name || 'Sistema',
        totalDebit: newEntryTotalDebit,
        totalCredit: newEntryTotalCredit,
        createdAt: new Date().toISOString(),
        lines: validLines.map((line) => ({
          accountCode: line.accountCode,
          accountName: line.accountName,
          description: line.description || newEntryDescription,
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0,
        })),
      };
      const raw = localStorage.getItem('kwanzaerp_journal_entries');
      const all = raw ? JSON.parse(raw) : [];
      all.push(entry);
      localStorage.setItem('kwanzaerp_journal_entries', JSON.stringify(all));
    }

    toast.success(`Lançamento ${createdEntry.entryNumber} criado com sucesso`, {
      description: `Débito: ${newEntryTotalDebit.toLocaleString('pt-AO')} Kz | Crédito: ${newEntryTotalCredit.toLocaleString('pt-AO')} Kz`,
    });

    setNewEntryOpen(false);
    await refetch();
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 border-b flex-wrap">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={openNewEntry}>
          <Plus className="w-3 h-3" /> Novo Lançamento
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={!selectedEntry}
          onClick={() => { setViewEntryOpen(true); }}>
          <Eye className="w-3 h-3" /> Ver
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        {/* Date filters */}
        <span className="text-xs text-muted-foreground">De:</span>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 text-xs w-32" />
        <span className="text-xs text-muted-foreground">Até:</span>
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 text-xs w-32" />
        <div className="w-px h-5 bg-border mx-1" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {ENTRY_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={refetch}><RefreshCw className="w-3 h-3" /></Button>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-7 text-xs pl-7 w-40" />
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-auto p-0">
          {['Diários', 'Balancete', 'Auditoria', 'Cashiers'].map((label, i) => {
            const key = ['diarios', 'balancete', 'auditoria', 'cashiers'][i];
            return (
              <TabsTrigger key={key} value={key}
                className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-1.5">
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="diarios" className="flex-1 m-0 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 border-b sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold w-24">Data</th>
                <th className="px-3 py-2 text-left font-semibold w-16">Tipo</th>
                <th className="px-3 py-2 text-center font-semibold w-12">Moeda</th>
                <th className="px-3 py-2 text-left font-semibold w-24">Nº Lançamento</th>
                <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Débito</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Crédito</th>
                <th className="px-3 py-2 text-left font-semibold w-20">Utilizador</th>
                <th className="px-3 py-2 text-center font-semibold w-12">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredEntries.map(entry => {
                const typeConfig = ENTRY_TYPES.find(t => t.value === entry.type);
                return (
                  <tr key={entry.id}
                    className={cn("cursor-pointer hover:bg-accent/50 transition-colors",
                      selectedEntryId === entry.id && "bg-primary/15")}
                    onClick={() => setSelectedEntryId(entry.id)}
                    onDoubleClick={() => { setSelectedEntryId(entry.id); setViewEntryOpen(true); }}>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString('pt-AO')}
                    </td>
                    <td className={cn("px-3 py-1.5 font-medium", typeConfig?.color)}>
                      {typeConfig?.label || entry.type}
                    </td>
                    <td className="px-3 py-1.5 text-center text-muted-foreground">{entry.currency}</td>
                    <td className="px-3 py-1.5 font-mono">{entry.entryNumber}</td>
                    <td className="px-3 py-1.5">{entry.description}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{entry.totalDebit.toLocaleString('pt-AO')}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{entry.totalCredit.toLocaleString('pt-AO')}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{entry.createdBy}</td>
                    <td className="px-3 py-1.5 text-center">
                      {entry.isPosted ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 inline" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-muted-foreground inline" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/80 border-t-2 border-primary/30">
              <tr className="font-bold text-xs">
                <td className="px-3 py-2" colSpan={5}>TOTAL ({filteredEntries.length} lançamentos)</td>
                <td className="px-3 py-2 text-right font-mono text-green-600">{totals.debit.toLocaleString('pt-AO')} Kz</td>
                <td className="px-3 py-2 text-right font-mono text-red-600">{totals.credit.toLocaleString('pt-AO')} Kz</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
          {filteredEntries.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum lançamento encontrado</div>
          )}
        </TabsContent>

        <TabsContent value="balancete" className="flex-1 m-0 p-4">
          <Card><CardContent className="pt-6 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Balancete será gerado a partir dos lançamentos</p>
            <p className="text-xs mt-1">Seleccione um período e clique em Gerar</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="auditoria" className="flex-1 m-0 p-4">
          <Card><CardContent className="pt-6 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Auditoria - Registo de todas as alterações</p>
            <p className="text-xs mt-1">Histórico completo de quem fez o quê e quando</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="cashiers" className="flex-1 m-0 p-4">
          <Card><CardContent className="pt-6 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Cashiers - Resumo por operador</p>
            <p className="text-xs mt-1">Vendas e recebimentos por caixa</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* View Entry Dialog */}
      <Dialog open={viewEntryOpen} onOpenChange={setViewEntryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lançamento {selectedEntry?.entryNumber}</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Data:</span> {new Date(selectedEntry.date).toLocaleDateString('pt-AO')}</div>
                <div><span className="text-muted-foreground">Tipo:</span> {ENTRY_TYPES.find(t => t.value === selectedEntry.type)?.label}</div>
                <div><span className="text-muted-foreground">Utilizador:</span> {selectedEntry.createdBy}</div>
              </div>
              <div className="text-sm"><span className="text-muted-foreground">Descrição:</span> {selectedEntry.description}</div>
              <table className="w-full text-xs border">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left">Conta</th>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Descrição</th>
                    <th className="px-3 py-2 text-right">Débito</th>
                    <th className="px-3 py-2 text-right">Crédito</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedEntry.lines.map(line => (
                    <tr key={line.id}>
                      <td className="px-3 py-1.5 font-mono">{line.accountCode}</td>
                      <td className="px-3 py-1.5">{line.accountName}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{line.description}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{line.debit ? line.debit.toLocaleString('pt-AO') : ''}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{line.credit ? line.credit.toLocaleString('pt-AO') : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/60 font-bold">
                  <tr>
                    <td className="px-3 py-2" colSpan={3}>TOTAL</td>
                    <td className="px-3 py-2 text-right font-mono">{selectedEntry.totalDebit.toLocaleString('pt-AO')}</td>
                    <td className="px-3 py-2 text-right font-mono">{selectedEntry.totalCredit.toLocaleString('pt-AO')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============= NEW ENTRY DIALOG ============= */}
      <Dialog open={newEntryOpen} onOpenChange={setNewEntryOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Novo Lançamento Manual
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={newEntryDate} onChange={e => setNewEntryDate(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={newEntryType} onValueChange={setNewEntryType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Filial</Label>
                <Input value={currentBranch?.name || 'Sede'} disabled className="h-8 text-sm bg-muted" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={newEntryDescription}
                onChange={e => setNewEntryDescription(e.target.value)}
                placeholder="Descrição do lançamento..."
                className="min-h-[40px] text-sm resize-none"
              />
            </div>

            {/* Lines table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold">Linhas do Lançamento</Label>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={autoBalance}>
                    Balancear Auto
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={addLine}>
                    <Plus className="w-3 h-3" /> Linha
                  </Button>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-2 py-1.5 text-left w-28">Conta</th>
                      <th className="px-2 py-1.5 text-left">Nome da Conta</th>
                      <th className="px-2 py-1.5 text-left w-40">Descrição</th>
                      <th className="px-2 py-1.5 text-right w-28">Débito</th>
                      <th className="px-2 py-1.5 text-right w-28">Crédito</th>
                      <th className="px-2 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {newEntryLines.map((line) => (
                      <tr key={line.id} className="group">
                        <td className="px-1 py-1 relative">
                          <Input
                            value={line.accountCode}
                            placeholder="Ex: 4.1.1"
                            className="h-7 text-xs font-mono"
                            onFocus={() => { setActiveLineId(line.id); setAccountSearch(''); }}
                            onChange={e => {
                              updateLine(line.id, 'accountCode', e.target.value);
                              setAccountSearch(e.target.value);
                              setActiveLineId(line.id);
                            }}
                          />
                          {/* Account picker dropdown */}
                          {activeLineId === line.id && (
                            <div className="absolute top-full left-0 z-50 w-72 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                              <div className="p-1">
                                <Input
                                  placeholder="Pesquisar conta..."
                                  value={accountSearch}
                                  onChange={e => setAccountSearch(e.target.value)}
                                  className="h-6 text-xs mb-1"
                                  autoFocus
                                />
                              </div>
                              {filteredAccounts.length === 0 ? (
                                <div className="px-2 py-3 text-center text-muted-foreground text-xs">
                                  Nenhuma conta encontrada
                                </div>
                              ) : (
                                filteredAccounts.map(acct => (
                                  <button
                                    key={acct.id}
                                    className="w-full text-left px-2 py-1 text-xs hover:bg-accent/50 flex items-center gap-2 rounded-sm"
                                    onMouseDown={e => {
                                      e.preventDefault();
                                      selectAccount(line.id, acct);
                                    }}
                                  >
                                    <span className="font-mono text-primary w-14 shrink-0">{acct.code}</span>
                                    <span className="truncate">{acct.name}</span>
                                    <span className="ml-auto text-muted-foreground">
                                      {(acct.current_balance || 0).toLocaleString('pt-AO')}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={line.accountName}
                            disabled
                            className="h-7 text-xs bg-muted/30"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={line.description}
                            placeholder="Descrição..."
                            onChange={e => updateLine(line.id, 'description', e.target.value)}
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.debit}
                            placeholder="0.00"
                            onChange={e => updateLine(line.id, 'debit', e.target.value)}
                            className="h-7 text-xs text-right font-mono"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.credit}
                            placeholder="0.00"
                            onChange={e => updateLine(line.id, 'credit', e.target.value)}
                            className="h-7 text-xs text-right font-mono"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => removeLine(line.id)}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/60">
                    <tr className="font-bold text-xs">
                      <td className="px-2 py-2" colSpan={3}>
                        TOTAL
                        {!isBalanced && newEntryTotalDebit + newEntryTotalCredit > 0 && (
                          <span className="ml-2 text-destructive font-normal">
                            (Diferença: {Math.abs(difference).toLocaleString('pt-AO')} Kz {difference > 0 ? 'a débito' : 'a crédito'})
                          </span>
                        )}
                        {isBalanced && newEntryTotalDebit > 0 && (
                          <span className="ml-2 text-green-600 font-normal">✓ Balanceado</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">{newEntryTotalDebit.toLocaleString('pt-AO')}</td>
                      <td className="px-2 py-2 text-right font-mono">{newEntryTotalCredit.toLocaleString('pt-AO')}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setNewEntryOpen(false)}>Cancelar</Button>
            <Button
              onClick={saveNewEntry}
              disabled={!isBalanced || newEntryTotalDebit === 0 || !newEntryDescription.trim()}
              className="gap-1"
            >
              <CheckCircle className="w-4 h-4" /> Lançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
