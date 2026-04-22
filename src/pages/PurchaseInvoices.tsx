import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProducts, useSuppliers, useAuth } from '@/hooks/useERP';
import { useBranchContext } from '@/contexts/BranchContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  PurchaseInvoice,
  PurchaseInvoiceLine,
  PurchaseInvoiceJournalLine,
  calculateLine,
  calculateInvoiceTotals,
  generateAutoJournalLines,
  getPurchaseInvoices,
  savePurchaseInvoice,
  generatePurchaseInvoiceNumber,
} from '@/lib/purchaseInvoiceStorage';
import { processTransaction } from '@/lib/transactionEngine';
import { ensureSupplierAccount } from '@/lib/chartOfAccountsEngine';
import { Supplier, Product } from '@/types/erp';
import { ProductDetailDialog } from '@/components/inventory/ProductDetailDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, Plus, Save, X, Trash2, Eye, FileText, BookOpen,
  Package, ArrowLeft, CheckCircle, Printer,
} from 'lucide-react';
import { saveDocument } from '@/lib/documentStorage';
import type { ERPDocument } from '@/types/documents';

// ─────────── Supplier Picker Dialog ───────────
function SupplierPickerDialog({
  open, onClose, suppliers, onSelect, onCreateNew, onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onSelect: (s: Supplier) => void;
  onCreateNew?: () => void;
  onRefresh?: () => void;
}) {
  // Auto-refresh when dialog opens
  useEffect(() => {
    if (open && onRefresh) onRefresh();
  }, [open, onRefresh]);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.nif?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Listagem de Contas — Fornecedores</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Pesquisar fornecedor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        {onCreateNew && (
          <Button variant="outline" size="sm" className="w-full gap-1" onClick={onCreateNew}>
            <Plus className="h-4 w-4" /> Criar Novo Fornecedor
          </Button>
        )}
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>Nome de Conta</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Tel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => { onSelect(s); onClose(); }}
                >
                  <TableCell className="font-mono text-xs">{s.nif || '—'}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-xs">{s.nif || 'Desconhecido'}</TableCell>
                  <TableCell className="text-xs">{s.phone || '—'}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum fornecedor encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

async function syncPurchaseInvoiceDocument(invoice: PurchaseInvoice) {
  const lines = invoice.lines.map(line => {
    const gross = line.totalQty * line.unitPrice;
    const discountAmount = Math.max(gross - line.total, 0);
    const discount = gross > 0 ? (discountAmount / gross) * 100 : 0;

    return {
      id: line.id,
      productId: line.productId || undefined,
      productSku: line.productCode,
      description: line.description,
      quantity: line.totalQty,
      unit: line.unit,
      unitPrice: line.unitPrice,
      discount: Math.round(discount * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      taxRate: line.ivaRate,
      taxAmount: line.ivaAmount,
      lineTotal: line.totalWithIva,
      accountCode: invoice.purchaseAccountCode,
    };
  });

  const document: ERPDocument = {
    id: invoice.id,
    documentType: 'fatura_compra',
    documentNumber: invoice.invoiceNumber,
    branchId: invoice.branchId,
    branchName: invoice.branchName,
    entityType: 'supplier',
    entityName: invoice.supplierName,
    entityNif: invoice.supplierNif,
    entityPhone: invoice.supplierPhone,
    entityCode: invoice.supplierAccountCode || undefined,
    paymentCondition: invoice.paymentDate ? `Pagamento até ${invoice.paymentDate}` : undefined,
    lines,
    subtotal: invoice.subtotal,
    totalDiscount: lines.reduce((sum, line) => sum + line.discountAmount, 0),
    totalTax: invoice.ivaTotal,
    total: invoice.total,
    currency: invoice.currency === 'KZ' ? 'AOA' : invoice.currency,
    amountPaid: 0,
    amountDue: invoice.total,
    accountCode: invoice.supplierAccountCode,
    status: 'confirmed',
    issueDate: invoice.date,
    issueTime: invoice.createdAt.includes('T') ? invoice.createdAt.split('T')[1].slice(0, 8) : new Date().toTimeString().slice(0, 8),
    dueDate: invoice.paymentDate,
    notes: invoice.extraNote,
    internalNotes: invoice.supplierInvoiceNo ? `Nº Fatura Fornecedor: ${invoice.supplierInvoiceNo}` : undefined,
    createdBy: invoice.createdBy,
    createdByName: invoice.createdByName,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    confirmedBy: invoice.createdBy,
    confirmedAt: invoice.updatedAt,
  };

  await saveDocument(document);
}

// ─────────── Product Picker Dialog ───────────
function ProductPickerDialog({
  open, onClose, products, onSelect, onCreateNew,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onSelect: (p: Product) => void;
  onCreateNew: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search) return products.slice(0, 100);
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    ).slice(0, 100);
  }, [products, search]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Lista de Produtos</span>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => { onClose(); onCreateNew(); }}>
              <Plus className="h-4 w-4" /> Novo Produto
            </Button>
          </DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Pesquisar produto por nome, SKU ou código de barras..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Categoria</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => { onSelect(p); onClose(); }}
                >
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {(p.cost || p.price || 0).toLocaleString('pt-AO')}
                  </TableCell>
                  <TableCell className="text-right">{p.stock}</TableCell>
                  <TableCell className="text-right">{p.taxRate}%</TableCell>
                  <TableCell>{p.unit || 'UN'}</TableCell>
                  <TableCell className="text-xs">{p.category}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado
                    <br />
                    <Button variant="link" size="sm" className="mt-2 gap-1" onClick={() => { onClose(); onCreateNew(); }}>
                      <Plus className="h-4 w-4" /> Criar novo produto
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─────────── Account Picker Dialog ───────────
function AccountPickerDialog({
  open, onClose, onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (code: string, name: string) => void;
}) {
  const [search, setSearch] = useState('');
  const accounts = useMemo(() => {
    try {
      const data = localStorage.getItem('kwanzaerp_chart_of_accounts');
      const all: Array<{ code: string; name: string; is_active: boolean }> = data ? JSON.parse(data) : [];
      return all.filter(a => a.is_active !== false).sort((a, b) => a.code.localeCompare(b.code));
    } catch { return []; }
  }, []);

  const filtered = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(a =>
      a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[70vh]">
        <DialogHeader>
          <DialogTitle>Pesquisar Conta</DialogTitle>
        </DialogHeader>
        <Input placeholder="Pesquisar por código ou nome..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        <ScrollArea className="h-[350px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. de Conta</TableHead>
                <TableHead>Nome de Conta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.code} className="cursor-pointer hover:bg-accent" onClick={() => { onSelect(a.code, a.name); onClose(); }}>
                  <TableCell className="font-mono">{a.code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─────────── Invoice View Dialog ───────────
function InvoiceViewDialog({
  open, onClose, invoice,
}: {
  open: boolean;
  onClose: () => void;
  invoice: PurchaseInvoice | null;
}) {
  if (!invoice) return null;

  const handlePrint = () => {
    const lines = invoice.lines.map(l => `
      <tr>
        <td style="font-family:monospace;font-size:11px">${l.productCode}</td>
        <td>${l.description}</td>
        <td style="text-align:right">${l.totalQty}</td>
        <td style="text-align:right;font-family:monospace">${l.unitPrice.toLocaleString('pt-AO')}</td>
        <td style="text-align:right">${l.ivaRate}%</td>
        <td style="text-align:right;font-family:monospace;font-weight:bold">${l.totalWithIva.toLocaleString('pt-AO')}</td>
      </tr>
    `).join('');
    const journalRows = invoice.journalLines.map(j => `
      <tr>
        <td style="font-family:monospace">${j.accountCode}</td>
        <td>${j.accountName}</td>
        <td>${j.note}</td>
        <td style="text-align:right;font-family:monospace">${j.debit > 0 ? j.debit.toLocaleString('pt-AO') : '—'}</td>
        <td style="text-align:right;font-family:monospace">${j.credit > 0 ? j.credit.toLocaleString('pt-AO') : '—'}</td>
      </tr>
    `).join('');
    const html = `<html><head><title>FC ${invoice.invoiceNumber}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px 8px}th{background:#f5f5f5;text-align:left}h2{color:#c2410c}@media print{body{margin:0}}</style>
    </head><body>
      <h2>FATURA DE COMPRA</h2>
      <p><strong>${invoice.invoiceNumber}</strong>${invoice.supplierInvoiceNo ? ' — Fatura Fornecedor: ' + invoice.supplierInvoiceNo : ''}</p>
      <table style="width:auto;border:none;margin-bottom:16px"><tr style="border:none">
        <td style="border:none"><strong>Fornecedor:</strong> ${invoice.supplierName}</td>
        <td style="border:none"><strong>Data:</strong> ${new Date(invoice.date).toLocaleDateString('pt-AO')}</td>
        <td style="border:none"><strong>Armazém:</strong> ${invoice.warehouseName}</td>
        <td style="border:none"><strong>Moeda:</strong> ${invoice.currency}</td>
      </tr></table>
      <table><thead><tr><th>Produto</th><th>Descrição</th><th>Qtd</th><th>Preço</th><th>IVA</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table>
      <div style="text-align:right;margin-top:12px">
        <p>Sub Total: <strong>${invoice.subtotal.toLocaleString('pt-AO')} ${invoice.currency}</strong></p>
        <p style="color:#c2410c">IVA: <strong>${invoice.ivaTotal.toLocaleString('pt-AO')} ${invoice.currency}</strong></p>
        <p style="font-size:16px">Líquido: <strong>${invoice.total.toLocaleString('pt-AO')} ${invoice.currency}</strong></p>
      </div>
      ${invoice.journalLines.length > 0 ? `<h3>Entrada Diário</h3><table><thead><tr><th>Conta</th><th>Nome</th><th>Nota</th><th>Débito</th><th>Crédito</th></tr></thead><tbody>${journalRows}</tbody></table>` : ''}
    </body></html>`;

    // Use iframe to avoid popup blocker
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-orange-600 font-bold">COMPRA</span>
            <span>{invoice.invoiceNumber}</span>
            <Badge variant={invoice.status === 'confirmed' ? 'default' : invoice.status === 'cancelled' ? 'destructive' : 'outline'}>
              {invoice.status === 'confirmed' ? 'Confirmado' : invoice.status === 'cancelled' ? 'Anulado' : 'Rascunho'}
            </Badge>
            <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-4 p-1">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Fornecedor:</span> <strong>{invoice.supplierName}</strong></div>
              <div><span className="text-muted-foreground">Data:</span> {format(new Date(invoice.date), 'dd/MM/yyyy')}</div>
              <div><span className="text-muted-foreground">Armazém:</span> {invoice.warehouseName}</div>
              <div><span className="text-muted-foreground">Moeda:</span> {invoice.currency}</div>
              {invoice.supplierInvoiceNo && (
                <div><span className="text-muted-foreground">Nº Fatura Fornecedor:</span> <strong>{invoice.supplierInvoiceNo}</strong></div>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.productCode}</TableCell>
                    <TableCell>{l.description}</TableCell>
                    <TableCell className="text-right">{l.totalQty}</TableCell>
                    <TableCell className="text-right font-mono">{l.unitPrice.toLocaleString('pt-AO')}</TableCell>
                    <TableCell className="text-right">{l.ivaRate}%</TableCell>
                    <TableCell className="text-right font-mono font-medium">{l.totalWithIva.toLocaleString('pt-AO')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end">
              <div className="space-y-1 text-sm w-64">
                <div className="flex justify-between"><span>Sub Total:</span> <strong className="font-mono">{invoice.subtotal.toLocaleString('pt-AO')}</strong></div>
                <div className="flex justify-between text-orange-600"><span>IVA:</span> <strong className="font-mono">{invoice.ivaTotal.toLocaleString('pt-AO')}</strong></div>
                <div className="flex justify-between text-lg border-t pt-1"><span>Líquido:</span> <strong className="font-mono">{invoice.total.toLocaleString('pt-AO')}</strong></div>
              </div>
            </div>
            {invoice.journalLines.length > 0 && (
              <>
                <h4 className="font-semibold text-sm mt-4">Entrada Diário</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead className="text-right">Débito</TableHead>
                      <TableHead className="text-right">Crédito</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.journalLines.map(j => (
                      <TableRow key={j.id}>
                        <TableCell className="font-mono text-xs">{j.accountCode}</TableCell>
                        <TableCell>{j.accountName}</TableCell>
                        <TableCell className="text-xs">{j.note}</TableCell>
                        <TableCell className="text-right font-mono">{j.debit > 0 ? j.debit.toLocaleString('pt-AO') : '—'}</TableCell>
                        <TableCell className="text-right font-mono">{j.credit > 0 ? j.credit.toLocaleString('pt-AO') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function PurchaseInvoices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentBranch, branches } = useBranchContext();
  const { products, addProduct: addProductToStock, refreshProducts } = useProducts(currentBranch?.id);
  const { suppliers, refreshSuppliers } = useSuppliers();
  const { toast } = useToast();
  const navigate = useNavigate();

  // State
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [accountPickerTarget, setAccountPickerTarget] = useState<'journal' | null>(null);
  const [editingJournalIdx, setEditingJournalIdx] = useState<number | null>(null);
  const [viewInvoice, setViewInvoice] = useState<PurchaseInvoice | null>(null);
  const [activeTab, setActiveTab] = useState('fatura');
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  // Form state
  const [form, setForm] = useState<Partial<PurchaseInvoice>>({});
  const [lines, setLines] = useState<PurchaseInvoiceLine[]>([]);
  const [journalLines, setJournalLines] = useState<PurchaseInvoiceJournalLine[]>([]);

  const activeSuppliers = useMemo(() => suppliers.filter(s => s.isActive), [suppliers]);

  // Load invoices
  useEffect(() => {
    getPurchaseInvoices(currentBranch?.id).then(setInvoices);
  }, [currentBranch?.id]);

  // Filtered list
  const filtered = useMemo(() => {
    if (!searchTerm) return invoices;
    const q = searchTerm.toLowerCase();
    return invoices.filter(i =>
      i.invoiceNumber.toLowerCase().includes(q) ||
      i.supplierName.toLowerCase().includes(q)
    );
  }, [invoices, searchTerm]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products.slice(0, 300);
    const q = searchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    ).slice(0, 300);
  }, [products, searchTerm]);

  // ─────── Create mode ───────
  const startCreate = useCallback(() => {
    const now = new Date().toISOString();
    setForm({
      date: now.split('T')[0],
      paymentDate: now.split('T')[0],
      currency: 'KZ',
      warehouseId: currentBranch?.id || '',
      warehouseName: currentBranch?.name || '',
      priceType: 'last_price',
      purchaseAccountCode: '2.1.1',
      ivaAccountCode: '3.3.1',
      transactionType: 'ALL',
      currencyRate: 1,
      taxRate2: 1000,
      surchargePercent: 0,
      changePrice: true,
      isPending: false,
    });
    setLines([]);
    setJournalLines([]);
    setActiveTab('fatura');
    setMode('create');
  }, [currentBranch]);

  useEffect(() => {
    if (searchParams.get('mode') !== 'create' || mode === 'create') return;
    startCreate();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('mode');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, mode, startCreate]);

   // Select supplier — auto-create CoA sub-account under 3.2 Fornecedores
  const handleSelectSupplier = useCallback(async (s: Supplier) => {
    const accountCode = await ensureSupplierAccount(s.id, s.name, s.nif);
    setForm(prev => ({
      ...prev,
      supplierAccountCode: accountCode,
      supplierId: s.id, // Real supplier DB ID for open items & balance updates
      supplierName: s.name,
      supplierNif: s.nif,
      supplierPhone: s.phone,
      supplierBalance: 0,
    }));
  }, []);

  // Add product line
  const handleAddProduct = useCallback((p: Product) => {
    const newLine = calculateLine({
      productId: p.id,
      productCode: p.sku,
      description: p.name,
      quantity: 1,
      packaging: 1,
      unitPrice: p.lastCost || p.cost || 0,
      discountPct: 0,
      discountPct2: 0,
      ivaRate: p.taxRate || 14,
      warehouseId: form.warehouseId || currentBranch?.id || '',
      warehouseName: form.warehouseName || currentBranch?.name || '',
      currentStock: p.stock,
      unit: p.unit || 'UN',
      barcode: p.barcode,
    });
    setLines(prev => [...prev, newLine]);
  }, [form.warehouseId, form.warehouseName, currentBranch]);

  const handleOpenProductPicker = useCallback(() => {
    setProductPickerOpen(true);
  }, []);

  const handleCloseCreate = useCallback(() => {
    setMode("list");
  }, []);

  const openSupplierPicker = useCallback(async () => {
    await refreshSuppliers();
    setSupplierPickerOpen(true);
  }, [refreshSuppliers]);

  // Update line field
  const updateLineField = useCallback((idx: number, field: keyof PurchaseInvoiceLine, value: number | string) => {
    setLines(prev => {
      const updated = [...prev];
      const line = { ...updated[idx], [field]: value };
      updated[idx] = calculateLine(line);
      return updated;
    });
  }, []);

  // Remove line
  const removeLine = useCallback((idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // Totals
  const totals = useMemo(() => calculateInvoiceTotals(lines), [lines]);

  // Add journal line
  const addJournalLine = useCallback(() => {
    setJournalLines(prev => [...prev, {
      id: `jl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      accountCode: '',
      accountName: '',
      currency: form.currency || 'KZ',
      note: '',
      debit: 0,
      credit: 0,
    }]);
  }, [form.currency]);

  const updateJournalLine = useCallback((idx: number, field: keyof PurchaseInvoiceJournalLine, value: string | number) => {
    setJournalLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }, []);

  const removeJournalLine = useCallback((idx: number) => {
    setJournalLines(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // Open account picker for a journal line
  const openAccountPicker = useCallback((idx: number) => {
    setEditingJournalIdx(idx);
    setAccountPickerTarget('journal');
    setAccountPickerOpen(true);
  }, []);

  const handleAccountSelect = useCallback((code: string, name: string) => {
    if (accountPickerTarget === 'journal' && editingJournalIdx !== null) {
      updateJournalLine(editingJournalIdx, 'accountCode', code);
      updateJournalLine(editingJournalIdx, 'accountName', name);
    }
    setAccountPickerTarget(null);
    setEditingJournalIdx(null);
  }, [accountPickerTarget, editingJournalIdx, updateJournalLine]);

  // ─────── SAVE (all phases) ───────
  const handleSave = useCallback(async () => {
    console.log('[PurchaseInvoices] === SAVE START ===');
    console.log('[PurchaseInvoices] form.supplierName:', form.supplierName);
    console.log('[PurchaseInvoices] form.supplierAccountCode:', form.supplierAccountCode);
    console.log('[PurchaseInvoices] lines count:', lines.length);
    console.log('[PurchaseInvoices] activeSuppliers count:', activeSuppliers.length);

    // Validate supplier FIRST before any async work
    if (!form.supplierName) {
      console.warn('[PurchaseInvoices] BLOCKED: No supplier name');
      toast({ title: 'Erro', description: 'Selecione um fornecedor', variant: 'destructive' });
      return;
    }

    const formWithSupplier = form as Partial<PurchaseInvoice> & { supplierId?: string; supplierInvoiceNo?: string };
    console.log('[PurchaseInvoices] formWithSupplier.supplierId:', formWithSupplier.supplierId);

    const matchedSupplier = activeSuppliers.find(s =>
      s.id === formWithSupplier.supplierId ||
      (!!form.supplierNif && s.nif === form.supplierNif) ||
      (!!form.supplierName && s.name.trim().toLowerCase() === form.supplierName.trim().toLowerCase())
    );
    console.log('[PurchaseInvoices] matchedSupplier:', matchedSupplier ? `${matchedSupplier.id} — ${matchedSupplier.name}` : 'NOT FOUND');

    const resolvedSupplierId = matchedSupplier?.id || formWithSupplier.supplierId;

    if (!resolvedSupplierId) {
      console.warn('[PurchaseInvoices] BLOCKED: No resolved supplier ID');
      toast({
        title: 'Erro',
        description: 'Fornecedor sem ligação válida. Crie ou selecione novamente o fornecedor na lista antes de guardar a compra.',
        variant: 'destructive',
      });
      return;
    }

    // Resolve supplier account code — with explicit error handling
    let resolvedSupplierAccountCode = form.supplierAccountCode || '';
    console.log('[PurchaseInvoices] Initial supplierAccountCode:', resolvedSupplierAccountCode);

    if (!resolvedSupplierAccountCode && matchedSupplier) {
      try {
        resolvedSupplierAccountCode = await ensureSupplierAccount(matchedSupplier.id, matchedSupplier.name, matchedSupplier.nif);
        console.log(`[PurchaseInvoices] Resolved supplier account: ${resolvedSupplierAccountCode} for ${matchedSupplier.name}`);
      } catch (err: any) {
        console.error('[PurchaseInvoices] Failed to resolve supplier account:', err);
        toast({
          title: 'Erro na conta do fornecedor',
          description: `Não foi possível resolver a conta contabilística: ${err?.message || 'Erro desconhecido'}`,
          variant: 'destructive',
        });
        return;
      }
    }
    if (!resolvedSupplierAccountCode) {
      console.warn('[PurchaseInvoices] BLOCKED: No supplier account code resolved');
      toast({
        title: 'Erro',
        description: 'O fornecedor seleccionado ainda não tem subconta contabilística válida.',
        variant: 'destructive',
      });
      return;
    }
    if (lines.length === 0) {
      console.warn('[PurchaseInvoices] BLOCKED: No lines');
      toast({ title: 'Erro', description: 'Adicione pelo menos um produto', variant: 'destructive' });
      return;
    }

    console.log('[PurchaseInvoices] All validations passed, building invoice...');

    const now = new Date().toISOString();
    const branchCode = currentBranch?.code || 'SEDE';

    // Phase 3: Auto-generate journal lines if none manually added
    let finalJournalLines = journalLines.length > 0 ? journalLines : [];

    const invoice: PurchaseInvoice = {
      id: crypto.randomUUID(),
      invoiceNumber: generatePurchaseInvoiceNumber(branchCode),
      supplierAccountCode: resolvedSupplierAccountCode,
      supplierName: matchedSupplier?.name || form.supplierName || '',
      supplierNif: matchedSupplier?.nif || form.supplierNif,
      supplierPhone: matchedSupplier?.phone || form.supplierPhone,
      supplierBalance: form.supplierBalance || 0,
      ref: form.ref,
      supplierInvoiceNo: formWithSupplier.supplierInvoiceNo,
      contact: form.contact,
      department: form.department,
      ref2: form.ref2,
      date: form.date || now,
      paymentDate: form.paymentDate || now,
      project: form.project,
      currency: form.currency || 'KZ',
      warehouseId: form.warehouseId || currentBranch?.id || '',
      warehouseName: form.warehouseName || currentBranch?.name || '',
      priceType: form.priceType || 'last_price',
      address: form.address,
      purchaseAccountCode: form.purchaseAccountCode || '2.1',
      ivaAccountCode: form.ivaAccountCode || '3.3.1',
      transactionType: form.transactionType || 'ALL',
      currencyRate: form.currencyRate || 1,
      taxRate2: form.taxRate2 || 1000,
      orderNo: form.orderNo,
      surchargePercent: form.surchargePercent || 0,
      changePrice: form.changePrice || false,
      isPending: form.isPending || false,
      extraNote: form.extraNote,
      lines,
      journalLines: finalJournalLines,
      subtotal: totals.subtotal,
      ivaTotal: totals.ivaTotal,
      total: totals.total,
      status: 'confirmed',
      branchId: currentBranch?.id || '',
      branchName: currentBranch?.name || '',
      createdBy: user?.id || '',
      createdByName: user?.name || '',
      createdAt: now,
      updatedAt: now,
    };

    // Phase 3: Generate auto journal entries
    const autoJournal = generateAutoJournalLines(invoice);
    invoice.journalLines = [...autoJournal, ...finalJournalLines];

    try {
      console.log('[PurchaseInvoices] Calling processTransaction...', {
        type: 'purchase_invoice',
        docId: invoice.id,
        docNumber: invoice.invoiceNumber,
        branchId: invoice.branchId,
        supplierId: resolvedSupplierId,
        supplierAccountCode: resolvedSupplierAccountCode,
        linesCount: invoice.lines.length,
        total: invoice.total,
      });
      // Use central transaction engine for atomic processing
      const txResult = await processTransaction({
        transactionType: 'purchase_invoice',
        documentId: invoice.id,
        documentNumber: invoice.invoiceNumber,
        branchId: invoice.branchId,
        branchName: invoice.branchName,
        userId: user?.id || '',
        userName: user?.name || '',
        date: invoice.date,
        currency: invoice.currency,
        description: `Fatura de Compra ${invoice.invoiceNumber} — ${invoice.supplierName}`,
        amount: invoice.total,

        // Phase 1: Stock entries — scoped to the selected warehouse
        stockEntries: invoice.lines
          .filter(l => l.productId && l.totalQty > 0)
          .map(l => ({
            productId: l.productId,
            productName: l.description,
            productSku: l.productCode,
            quantity: l.totalQty,
            unitCost: l.unitPrice,
            direction: 'IN' as const,
            warehouseId: l.warehouseId || invoice.warehouseId, // BRANCH-SCOPED
          })),

        // Phase 2: Price updates (WAC)
        priceUpdates: invoice.changePrice
          ? invoice.lines
              .filter(l => l.productId && l.totalQty > 0)
              .map(l => ({
                productId: l.productId,
                newUnitCost: l.unitPrice,
                quantityReceived: l.totalQty,
                updateAvgCost: true,
              }))
          : undefined,

        // Phase 3: Journal entries
        journalLines: [
          // Debit: Purchase account
          ...(invoice.subtotal > 0 ? [{
            accountCode: invoice.purchaseAccountCode || '2.1',
            accountName: 'Compra de Mercadorias',
            debit: invoice.subtotal,
            credit: 0,
            note: `FC ${invoice.invoiceNumber}`,
          }] : []),
          // Debit: IVA
          ...(invoice.ivaTotal > 0 ? [{
            accountCode: invoice.ivaAccountCode || '3.3.1',
            accountName: 'IVA Dedutível',
            debit: invoice.ivaTotal,
            credit: 0,
            note: `IVA - FC ${invoice.invoiceNumber}`,
          }] : []),
          // Credit: Supplier
          {
            accountCode: invoice.supplierAccountCode,
            accountName: invoice.supplierName,
            debit: 0,
            credit: invoice.total,
            note: `FC ${invoice.invoiceNumber}`,
          },
          // Add manual journal lines
          ...finalJournalLines.map(jl => ({
            accountCode: jl.accountCode,
            accountName: jl.accountName,
            debit: jl.debit,
            credit: jl.credit,
            note: jl.note,
          })),
        ],

        // Phase 4: Open item (payable to supplier) — use REAL supplier ID
        openItem: {
          entityType: 'supplier',
          entityId: resolvedSupplierId,
          entityName: invoice.supplierName,
          documentType: 'invoice',
          originalAmount: invoice.total,
          isDebit: true,
          dueDate: invoice.paymentDate,
          currency: invoice.currency === 'KZ' ? 'AOA' : invoice.currency,
        },

        // Phase 6: Update supplier balance — use REAL supplier ID
        entityBalanceUpdate: {
          entityType: 'supplier',
          entityId: resolvedSupplierId,
          entityName: invoice.supplierName,
          entityNif: invoice.supplierNif,
          amount: invoice.total,
        },
      });

      console.log('[PurchaseInvoices] Transaction result:', JSON.stringify(txResult));

      if (!txResult.success) {
        const txError = txResult.errors.join('; ') || 'Stock e contabilidade não foram actualizados.';
        const description = txError.includes('invalid input syntax for type uuid')
          ? 'Existe um ID inválido na compra. Reabra o fornecedor e o armazém, depois grave novamente.'
          : txError;

        console.error('[PurchaseInvoices] Transaction engine errors:', txResult.errors);
        toast({
          title: 'Aviso: Falha no motor de transação',
          description,
          variant: 'destructive',
        });
        return;
      }

      await savePurchaseInvoice(invoice);
      await syncPurchaseInvoiceDocument(invoice);
      await Promise.all([refreshProducts(), refreshSuppliers()]);

      toast({
        title: 'Fatura de Compra Guardada',
        description: `${invoice.invoiceNumber} — ${invoice.supplierName} — ${invoice.total.toLocaleString('pt-AO')} ${invoice.currency}`,
      });

      getPurchaseInvoices(currentBranch?.id).then(setInvoices);
      setMode('list');
    } catch (error: any) {
      console.error('[PurchaseInvoices] Failed to save purchase invoice:', error);
      toast({
        title: 'Erro ao guardar a fatura de compra',
        description: error?.message || 'A compra não foi sincronizada corretamente com stock e fornecedor.',
        variant: 'destructive',
      });
    }
  }, [activeSuppliers, form, lines, journalLines, totals, currentBranch, user, toast, refreshProducts, refreshSuppliers]);

  // ═══════════════ RENDER ═══════════════


  // ─── LIST MODE ───
  if (mode === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Fatura de Compra</h1>
              <p className="text-sm text-muted-foreground">Gestão de facturas de compra / COMPRA</p>
            </div>
          </div>
          <Button
            onClick={() => setSearchParams({ mode: "create" })}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Nova Fatura de Compra
          </Button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Fatura</TableHead>
                  <TableHead>Nº Fatura Fornecedor</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Armazém</TableHead>
                  <TableHead className="text-right">Sub Total</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-xs">{inv.supplierInvoiceNo || '—'}</TableCell>
                    <TableCell>{inv.supplierName}</TableCell>
                    <TableCell className="text-sm">{format(new Date(inv.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-sm">{inv.warehouseName}</TableCell>
                    <TableCell className="text-right font-mono">{inv.subtotal.toLocaleString('pt-AO')}</TableCell>
                    <TableCell className="text-right font-mono text-orange-600">{inv.ivaTotal.toLocaleString('pt-AO')}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{inv.total.toLocaleString('pt-AO')}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === 'confirmed' ? 'default' : inv.status === 'cancelled' ? 'destructive' : 'outline'}>
                        {inv.status === 'confirmed' ? 'Confirmado' : inv.status === 'cancelled' ? 'Anulado' : 'Rascunho'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setViewInvoice(inv)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      Nenhuma fatura de compra encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <InvoiceViewDialog open={!!viewInvoice} onClose={() => setViewInvoice(null)} invoice={viewInvoice} />
      </div>
    );
  }

  // ─── CREATE MODE ───
  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleCloseCreate}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-orange-600 font-bold text-xl">COMPRA</span>
              <span className="font-mono text-sm text-muted-foreground">
                {form.supplierAccountCode || '—'}
              </span>
              <span className="font-medium">{form.supplierName || '—'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCloseCreate} className="gap-1">
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1">
            <Save className="h-4 w-4" /> Guardar
          </Button>
        </div>
      </div>

      {/* Supplier bar */}
      {!form.supplierName && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/30">
          <CardContent className="py-4">
            <Button variant="outline" onClick={() => void openSupplierPicker()} className="gap-2 w-full justify-start">
              <Search className="h-4 w-4" /> Selecionar Fornecedor...
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Fatura / Entrada do Diário */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="fatura" className="gap-1"><FileText className="h-4 w-4" /> Fatura</TabsTrigger>
          <TabsTrigger value="diario" className="gap-1"><BookOpen className="h-4 w-4" /> Entrada do Diário</TabsTrigger>
        </TabsList>

        {/* ──── FATURA TAB ──── */}
        <TabsContent value="fatura" className="space-y-3 mt-2">
          {/* Header form */}
          <div className="grid grid-cols-12 gap-3">
            {/* Left: main fields */}
            <Card className="col-span-4">
              <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">No</Label>
                    <Input value={form.ref || ''} onChange={e => setForm(p => ({ ...p, ref: e.target.value }))} placeholder="Auto" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Nº Fatura Fornecedor</Label>
                    <Input value={(form as any).supplierInvoiceNo || ''} onChange={e => setForm(p => ({ ...p, supplierInvoiceNo: e.target.value }))} placeholder="Nº da fatura do fornecedor" className="h-8 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Ref</Label>
                    <Input value={form.ref2 || ''} onChange={e => setForm(p => ({ ...p, ref2: e.target.value }))} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Departamento</Label>
                    <Input value={form.department || ''} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={form.date || ''} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Data Pagamento</Label>
                    <Input type="date" value={form.paymentDate || ''} onChange={e => setForm(p => ({ ...p, paymentDate: e.target.value }))} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Moeda</Label>
                    <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KZ">KZ</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Armazém</Label>
                    <Select value={form.warehouseId} onValueChange={v => {
                      const br = branches.find(b => b.id === v);
                      setForm(p => ({ ...p, warehouseId: v, warehouseName: br?.name || v }));
                    }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Contacto</Label>
                  <Input value={form.contact || ''} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} className="h-8 text-xs" placeholder={form.supplierPhone || '—'} />
                </div>
                <div>
                  <Label className="text-xs">Tipo de Preço</Label>
                  <Select value={form.priceType} onValueChange={v => setForm(p => ({ ...p, priceType: v as any }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_price">Last Price</SelectItem>
                      <SelectItem value="average_price">Average Price</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.supplierName && (
                  <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => void openSupplierPicker()}>
                    Alterar Fornecedor
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Center: options */}
            <Card className="col-span-4">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="changePrice"
                    checked={form.changePrice}
                    onCheckedChange={v => setForm(p => ({ ...p, changePrice: !!v }))}
                  />
                  <Label htmlFor="changePrice" className="text-xs font-medium">Change Price</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pending"
                    checked={form.isPending}
                    onCheckedChange={v => setForm(p => ({ ...p, isPending: !!v }))}
                  />
                  <Label htmlFor="pending" className="text-xs">Pendente</Label>
                </div>
                <div>
                  <Label className="text-xs">Extra Note</Label>
                  <Textarea
                    value={form.extraNote || ''}
                    onChange={e => setForm(p => ({ ...p, extraNote: e.target.value }))}
                    className="text-xs h-16 resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Right: accounting codes */}
            <Card className="col-span-4 border-red-200 dark:border-red-900">
              <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="text-muted-foreground">Conta de Fatura</span>
                  <Input value={form.purchaseAccountCode || ''} onChange={e => setForm(p => ({ ...p, purchaseAccountCode: e.target.value }))} className="h-7 text-xs font-mono" />
                  <span className="text-muted-foreground">IVA Conta</span>
                  <Input value={form.ivaAccountCode || ''} onChange={e => setForm(p => ({ ...p, ivaAccountCode: e.target.value }))} className="h-7 text-xs font-mono" />
                  <span className="text-muted-foreground">Transação</span>
                  <Input value={form.transactionType || ''} onChange={e => setForm(p => ({ ...p, transactionType: e.target.value }))} className="h-7 text-xs font-mono" />
                  <span className="text-muted-foreground">Moeda Valor</span>
                  <Input type="number" value={form.currencyRate || 1} onChange={e => setForm(p => ({ ...p, currencyRate: parseFloat(e.target.value) || 1 }))} className="h-7 text-xs font-mono" />
                  <span className="text-muted-foreground">Taxa 2</span>
                  <Input type="number" value={form.taxRate2 || 1000} onChange={e => setForm(p => ({ ...p, taxRate2: parseFloat(e.target.value) || 0 }))} className="h-7 text-xs font-mono" />
                  <span className="text-muted-foreground">Ordem NO.</span>
                  <Input value={form.orderNo || ''} onChange={e => setForm(p => ({ ...p, orderNo: e.target.value }))} className="h-7 text-xs font-mono" />
                  <span className="text-muted-foreground">Sobrecusto%</span>
                  <Input type="number" value={form.surchargePercent || 0} onChange={e => setForm(p => ({ ...p, surchargePercent: parseFloat(e.target.value) || 0 }))} className="h-7 text-xs font-mono" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Product lines toolbar */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={handleOpenProductPicker}>
              <Plus className="h-4 w-4" /> Inserir Produto
            </Button>
            <Button variant="ghost" size="sm" className="gap-1" onClick={handleOpenProductPicker}>
              <Search className="h-4 w-4" /> Encontrar
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">F2 para pesquisar</span>
          </div>

          {/* Product lines grid */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                     <TableRow className="text-xs">
                       <TableHead className="w-8">#</TableHead>
                       <TableHead>Produto</TableHead>
                       <TableHead className="min-w-[200px]">Descrição</TableHead>
                       <TableHead className="w-20 text-right">Qtd</TableHead>
                       <TableHead className="w-16 text-right">Emb.</TableHead>
                       <TableHead className="w-24 text-right">Preço (s/IVA)</TableHead>
                       <TableHead className="w-16 text-right">Desc %</TableHead>
                       <TableHead className="w-16 text-right">% 2</TableHead>
                       <TableHead className="w-20 text-right">Total QTD</TableHead>
                       <TableHead className="w-28 text-right">Base Trib.</TableHead>
                       <TableHead className="w-16 text-right">IVA%</TableHead>
                       <TableHead className="w-20 text-right">Valor IVA</TableHead>
                       <TableHead className="w-24">Armazém</TableHead>
                       <TableHead className="w-20 text-right">Qtd Atual</TableHead>
                       <TableHead className="w-28 text-right">Total c/IVA</TableHead>
                       <TableHead className="w-16">Unidade</TableHead>
                       <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, idx) => (
                      <TableRow key={line.id} className="text-xs">
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono">{line.productCode}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{line.description}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.quantity}
                            onChange={e => updateLineField(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-7 w-16 text-xs text-right font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.packaging}
                            onChange={e => updateLineField(idx, 'packaging', parseFloat(e.target.value) || 1)}
                            className="h-7 w-14 text-xs text-right font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.unitPrice}
                            onChange={e => updateLineField(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="h-7 w-20 text-xs text-right font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.discountPct}
                            onChange={e => updateLineField(idx, 'discountPct', parseFloat(e.target.value) || 0)}
                            className="h-7 w-14 text-xs text-right font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.discountPct2}
                            onChange={e => updateLineField(idx, 'discountPct2', parseFloat(e.target.value) || 0)}
                            className="h-7 w-14 text-xs text-right font-mono"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono">{line.totalQty}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{line.total.toLocaleString('pt-AO')}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.ivaRate}
                            onChange={e => updateLineField(idx, 'ivaRate', parseFloat(e.target.value) || 0)}
                            className="h-7 w-14 text-xs text-right font-mono"
                            onWheel={e => (e.target as HTMLInputElement).blur()}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{line.ivaAmount.toLocaleString('pt-AO')}</TableCell>
                        <TableCell className="text-xs">{line.warehouseName}</TableCell>
                        <TableCell className="text-right font-mono">{line.currentStock}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{line.totalWithIva.toLocaleString('pt-AO')}</TableCell>
                        <TableCell>{line.unit}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(idx)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {lines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={18} className="text-center py-8 text-muted-foreground">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Clique em "Inserir Produto" ou pressione F2 para adicionar produtos
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Totals bar */}
          <div className="flex justify-end">
            <Card className="w-72">
              <CardContent className="p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sub Total</span>
                  <span className="font-mono font-medium">{totals.subtotal.toLocaleString('pt-AO')}</span>
                </div>
                <div className="flex justify-between text-sm text-orange-600">
                  <span>IVA</span>
                  <span className="font-mono font-medium">{totals.ivaTotal.toLocaleString('pt-AO')}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-1">
                  <span>Líquido</span>
                  <span className="font-mono">{totals.total.toLocaleString('pt-AO')}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ──── DIÁRIO TAB ──── */}
        <TabsContent value="diario" className="space-y-3 mt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Entrada Diário de Fatura — Lançamentos adicionais</h3>
            <Button variant="outline" size="sm" className="gap-1" onClick={addJournalLine}>
              <Plus className="h-4 w-4" /> Adicionar Linha
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>No. de Conta</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Moeda</TableHead>
                    <TableHead className="min-w-[180px]">Nota</TableHead>
                    <TableHead className="w-28 text-right">Débito</TableHead>
                    <TableHead className="w-28 text-right">Crédito</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journalLines.map((jl, idx) => (
                    <TableRow key={jl.id} className="text-xs">
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            value={jl.accountCode}
                            onChange={e => updateJournalLine(idx, 'accountCode', e.target.value)}
                            className="h-7 w-28 text-xs font-mono"
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openAccountPicker(idx)}>
                            <Search className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={jl.accountName}
                          onChange={e => updateJournalLine(idx, 'accountName', e.target.value)}
                          className="h-7 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={jl.currency} onValueChange={v => updateJournalLine(idx, 'currency', v)}>
                          <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="KZ">KZ</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={jl.note}
                          onChange={e => updateJournalLine(idx, 'note', e.target.value)}
                          className="h-7 text-xs"
                          placeholder="Descrição..."
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={jl.debit || ''}
                          onChange={e => updateJournalLine(idx, 'debit', parseFloat(e.target.value) || 0)}
                          className="h-7 w-24 text-xs text-right font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={jl.credit || ''}
                          onChange={e => updateJournalLine(idx, 'credit', parseFloat(e.target.value) || 0)}
                          className="h-7 w-24 text-xs text-right font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeJournalLine(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {journalLines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Os lançamentos automáticos (Compra, IVA, Fornecedor) são gerados ao guardar.
                        <br />
                        Adicione linhas aqui para despesas adicionais (ex: Frete, Despesas Alfandegárias).
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {journalLines.length > 0 && (
            <div className="flex justify-end text-sm">
              <div className="w-72 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Débito:</span>
                  <span className="font-mono">{journalLines.reduce((s, l) => s + l.debit, 0).toLocaleString('pt-AO')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Crédito:</span>
                  <span className="font-mono">{journalLines.reduce((s, l) => s + l.credit, 0).toLocaleString('pt-AO')}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>Diferença:</span>
                  <span className={`font-mono ${Math.abs(journalLines.reduce((s, l) => s + l.debit - l.credit, 0)) > 0.01 ? 'text-destructive' : 'text-green-600'}`}>
                    {journalLines.reduce((s, l) => s + l.debit - l.credit, 0).toLocaleString('pt-AO')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <SupplierPickerDialog
        open={supplierPickerOpen}
        onClose={() => setSupplierPickerOpen(false)}
        suppliers={activeSuppliers}
        onSelect={handleSelectSupplier}
        onRefresh={refreshSuppliers}
        onCreateNew={() => {
          setSupplierPickerOpen(false);
          // Navigate to suppliers page to create
          navigate('/suppliers');
        }}
      />
      <ProductPickerDialog
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        products={products}
        onSelect={handleAddProduct}
        onCreateNew={() => setShowCreateProduct(true)}
      />
      <AccountPickerDialog
        open={accountPickerOpen}
        onClose={() => setAccountPickerOpen(false)}
        onSelect={handleAccountSelect}
      />
      <ProductDetailDialog
        open={showCreateProduct}
        onOpenChange={setShowCreateProduct}
        product={null}
        onSave={async (newProduct) => {
          await addProductToStock(newProduct);
          handleAddProduct(newProduct);
          toast({ title: 'Produto criado', description: `${newProduct.name} adicionado ao stock e à fatura` });
        }}
      />
    </div>
  );
}
