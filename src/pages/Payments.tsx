import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { useBranchContext } from '@/contexts/BranchContext';
import { useAuth } from '@/hooks/useERP';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Plus, Search, RefreshCw, CreditCard, Receipt,
  ArrowDownCircle, ArrowUpCircle, CheckCircle, Clock,
  Banknote, Building2, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClients, useSuppliers } from '@/hooks/useERP';
import type { OpenItem, Payment } from '@/types/erp';

// Demo data for localStorage mode
function usePaymentsData() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [openItems, setOpenItems] = useState<OpenItem[]>([]);

  const refresh = useCallback(() => {
    try {
      const stored = localStorage.getItem('kwanzaerp_payments');
      setPayments(stored ? JSON.parse(stored) : []);
      const storedOI = localStorage.getItem('kwanzaerp_open_items');
      setOpenItems(storedOI ? JSON.parse(storedOI) : []);
    } catch { setPayments([]); setOpenItems([]); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createPayment = useCallback((payment: Payment, selectedItems: OpenItem[]) => {
    // Save payment
    const all = JSON.parse(localStorage.getItem('kwanzaerp_payments') || '[]');
    all.push(payment);
    localStorage.setItem('kwanzaerp_payments', JSON.stringify(all));

    // Update open items (clear selected)
    const allOI: OpenItem[] = JSON.parse(localStorage.getItem('kwanzaerp_open_items') || '[]');
    let remaining = payment.amount;
    for (const sel of selectedItems) {
      const idx = allOI.findIndex(o => o.id === sel.id);
      if (idx >= 0 && remaining > 0) {
        const clearAmount = Math.min(remaining, allOI[idx].remainingAmount);
        allOI[idx].remainingAmount -= clearAmount;
        allOI[idx].status = allOI[idx].remainingAmount <= 0 ? 'cleared' : 'partial';
        if (allOI[idx].remainingAmount <= 0) allOI[idx].clearedAt = new Date().toISOString();
        remaining -= clearAmount;
      }
    }
    localStorage.setItem('kwanzaerp_open_items', JSON.stringify(allOI));
    refresh();
    return payment;
  }, [refresh]);

  return { payments, openItems, refresh, createPayment };
}

export default function Payments() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentBranch } = useBranchContext();
  const { clients } = useClients();
  const { suppliers } = useSuppliers();
  const { payments, openItems, refresh, createPayment } = usePaymentsData();

  const [activeTab, setActiveTab] = useState<'receipts' | 'payments' | 'open-items'>('receipts');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [paymentType, setPaymentType] = useState<'receipt' | 'payment'>('receipt');

  // New payment form
  const [entityId, setEntityId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'cheque'>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedOpenItems, setSelectedOpenItems] = useState<Set<string>>(new Set());

  const entities = paymentType === 'receipt' ? clients : suppliers;
  const entityLabel = paymentType === 'receipt' ? 'Cliente' : 'Fornecedor';

  const entityOpenItems = useMemo(() => {
    if (!entityId) return [];
    const entType = paymentType === 'receipt' ? 'customer' : 'supplier';
    return openItems.filter(oi => oi.entityType === entType && oi.entityId === entityId && oi.status !== 'cleared');
  }, [entityId, paymentType, openItems]);

  const selectedTotal = useMemo(() => {
    return entityOpenItems
      .filter(oi => selectedOpenItems.has(oi.id))
      .reduce((sum, oi) => sum + oi.remainingAmount, 0);
  }, [entityOpenItems, selectedOpenItems]);

  const filteredPayments = useMemo(() => {
    const typeFilter = activeTab === 'receipts' ? 'receipt' : 'payment';
    return payments
      .filter(p => activeTab === 'open-items' || p.paymentType === typeFilter)
      .filter(p => !searchTerm || p.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) || p.paymentNumber.includes(searchTerm));
  }, [payments, activeTab, searchTerm]);

  const resetForm = () => {
    setEntityId('');
    setPaymentMethod('cash');
    setAmount('');
    setReference('');
    setNotes('');
    setSelectedOpenItems(new Set());
  };

  const handleCreate = () => {
    if (!entityId || !amount || Number(amount) <= 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const entity = entities.find(e => e.id === entityId);
    const payment: Payment = {
      id: crypto.randomUUID(),
      paymentNumber: `${paymentType === 'receipt' ? 'REC' : 'PAG'}-${Date.now().toString(36).toUpperCase()}`,
      paymentType,
      entityType: paymentType === 'receipt' ? 'customer' : 'supplier',
      entityId,
      entityName: entity?.name || '',
      paymentMethod,
      amount: Number(amount),
      currency: 'AOA',
      reference,
      notes,
      branchId: currentBranch?.id || '',
      createdBy: user?.id || '',
      createdAt: new Date().toISOString(),
    };

    const selected = entityOpenItems.filter(oi => selectedOpenItems.has(oi.id));
    createPayment(payment, selected);
    toast.success(`${paymentType === 'receipt' ? 'Recibo' : 'Pagamento'} registado com sucesso`);
    setShowNewDialog(false);
    resetForm();
  };

  const openNewDialog = (type: 'receipt' | 'payment') => {
    setPaymentType(type);
    resetForm();
    setShowNewDialog(true);
  };

  const totalReceipts = payments.filter(p => p.paymentType === 'receipt').reduce((s, p) => s + p.amount, 0);
  const totalPayments = payments.filter(p => p.paymentType === 'payment').reduce((s, p) => s + p.amount, 0);
  const totalOpenReceivable = openItems.filter(oi => oi.entityType === 'customer' && oi.status !== 'cleared').reduce((s, oi) => s + oi.remainingAmount, 0);
  const totalOpenPayable = openItems.filter(oi => oi.entityType === 'supplier' && oi.status !== 'cleared').reduce((s, oi) => s + oi.remainingAmount, 0);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 p-4 pb-2">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Recebimentos</p>
                <p className="text-lg font-bold">{totalReceipts.toLocaleString('pt-AO')} Kz</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Pagamentos</p>
                <p className="text-lg font-bold">{totalPayments.toLocaleString('pt-AO')} Kz</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">A Receber</p>
                <p className="text-lg font-bold">{totalOpenReceivable.toLocaleString('pt-AO')} Kz</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">A Pagar</p>
                <p className="text-lg font-bold">{totalOpenPayable.toLocaleString('pt-AO')} Kz</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <Button size="sm" className="gap-1" onClick={() => openNewDialog('receipt')}>
          <ArrowDownCircle className="w-4 h-4" /> Novo Recibo
        </Button>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => openNewDialog('payment')}>
          <ArrowUpCircle className="w-4 h-4" /> Novo Pagamento
        </Button>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-8 w-48 text-sm" />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refresh}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-auto p-0">
          <TabsTrigger value="receipts" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2">
            Recibos ({payments.filter(p => p.paymentType === 'receipt').length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2">
            Pagamentos ({payments.filter(p => p.paymentType === 'payment').length})
          </TabsTrigger>
          <TabsTrigger value="open-items" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2">
            Itens Abertos ({openItems.filter(oi => oi.status !== 'cleared').length})
          </TabsTrigger>
        </TabsList>

        {/* Receipts / Payments Table */}
        {(activeTab === 'receipts' || activeTab === 'payments') && (
          <TabsContent value={activeTab} className="flex-1 m-0 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 border-b sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Nº</th>
                  <th className="px-3 py-2 text-left font-semibold">Data</th>
                  <th className="px-3 py-2 text-left font-semibold">{activeTab === 'receipts' ? 'Cliente' : 'Fornecedor'}</th>
                  <th className="px-3 py-2 text-left font-semibold">Método</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor</th>
                  <th className="px-3 py-2 text-left font-semibold">Referência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredPayments.map(p => (
                  <tr key={p.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-3 py-2 font-mono text-xs">{p.paymentNumber}</td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(p.createdAt).toLocaleDateString('pt-AO')}</td>
                    <td className="px-3 py-2">{p.entityName}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-xs">
                        {p.paymentMethod === 'cash' ? 'Dinheiro' : p.paymentMethod === 'card' ? 'Cartão' : p.paymentMethod === 'transfer' ? 'Transf.' : p.paymentMethod === 'cheque' ? 'Cheque' : p.paymentMethod}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium">{p.amount.toLocaleString('pt-AO')} Kz</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{p.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPayments.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum {activeTab === 'receipts' ? 'recibo' : 'pagamento'} encontrado</p>
              </div>
            )}
          </TabsContent>
        )}

        {/* Open Items */}
        <TabsContent value="open-items" className="flex-1 m-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 border-b sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                <th className="px-3 py-2 text-left font-semibold">Documento</th>
                <th className="px-3 py-2 text-left font-semibold">Data</th>
                <th className="px-3 py-2 text-left font-semibold">Vencimento</th>
                <th className="px-3 py-2 text-right font-semibold">Original</th>
                <th className="px-3 py-2 text-right font-semibold">Em Aberto</th>
                <th className="px-3 py-2 text-center font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {openItems.filter(oi => oi.status !== 'cleared').map(oi => (
                <tr key={oi.id} className="hover:bg-accent/50">
                  <td className="px-3 py-2">
                    <Badge variant={oi.entityType === 'customer' ? 'default' : 'secondary'} className="text-xs">
                      {oi.entityType === 'customer' ? 'Cliente' : 'Fornecedor'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{oi.documentNumber}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(oi.documentDate).toLocaleDateString('pt-AO')}</td>
                  <td className="px-3 py-2 text-muted-foreground">{oi.dueDate ? new Date(oi.dueDate).toLocaleDateString('pt-AO') : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{oi.originalAmount.toLocaleString('pt-AO')} Kz</td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{oi.remainingAmount.toLocaleString('pt-AO')} Kz</td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant={oi.status === 'open' ? 'destructive' : 'outline'} className="text-xs">
                      {oi.status === 'open' ? 'Aberto' : 'Parcial'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {openItems.filter(oi => oi.status !== 'cleared').length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum item em aberto</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New Payment Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paymentType === 'receipt' ? <ArrowDownCircle className="w-5 h-5 text-green-500" /> : <ArrowUpCircle className="w-5 h-5 text-red-500" />}
              {paymentType === 'receipt' ? 'Novo Recibo (Recebimento)' : 'Novo Pagamento (a Fornecedor)'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Entity Select */}
            <div>
              <Label>{entityLabel}</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger><SelectValue placeholder={`Seleccionar ${entityLabel.toLowerCase()}...`} /></SelectTrigger>
                <SelectContent>
                  {entities.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name} — {e.nif}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Open Items for this entity */}
            {entityId && entityOpenItems.length > 0 && (
              <div>
                <Label className="mb-2 block">Documentos em Aberto (seleccione para compensar)</Label>
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 w-8"></th>
                        <th className="px-2 py-1.5 text-left">Documento</th>
                        <th className="px-2 py-1.5 text-left">Data</th>
                        <th className="px-2 py-1.5 text-right">Em Aberto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {entityOpenItems.map(oi => (
                        <tr key={oi.id} className={cn("cursor-pointer hover:bg-accent/50", selectedOpenItems.has(oi.id) && "bg-primary/10")}>
                          <td className="px-2 py-1.5">
                            <Checkbox
                              checked={selectedOpenItems.has(oi.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedOpenItems);
                                checked ? next.add(oi.id) : next.delete(oi.id);
                                setSelectedOpenItems(next);
                              }}
                            />
                          </td>
                          <td className="px-2 py-1.5 font-mono">{oi.documentNumber}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{new Date(oi.documentDate).toLocaleDateString('pt-AO')}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{oi.remainingAmount.toLocaleString('pt-AO')} Kz</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedOpenItems.size > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Total seleccionado: <strong>{selectedTotal.toLocaleString('pt-AO')} Kz</strong>
                  </p>
                )}
              </div>
            )}

            {/* Payment Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Método de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="card">Cartão</SelectItem>
                    <SelectItem value="transfer">Transferência Bancária</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor (Kz)</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                  onFocus={() => { if (!amount && selectedTotal > 0) setAmount(selectedTotal.toString()); }}
                />
              </div>
            </div>

            <div>
              <Label>Referência (nº cheque, transferência, etc.)</Label>
              <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Opcional" />
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observações..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>
              {paymentType === 'receipt' ? 'Registar Recibo' : 'Registar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
