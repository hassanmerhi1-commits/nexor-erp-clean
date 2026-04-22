// Kwanza ERP - Import/Export (Importação) Module
// Customs, shipping, landed cost, forex

import { useState, useMemo } from 'react';
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
  Plus, Search, Edit2, RefreshCw, Globe, Ship, Plane,
  FileText, DollarSign, Package, Truck, CheckCircle, Clock,
  ArrowRight, Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportOrder {
  id: string;
  orderNumber: string;      // IMP-20260328-001
  supplierId?: string;
  supplierName: string;
  supplierCountry: string;
  
  // Shipment
  transportMode: 'sea' | 'air' | 'land';
  incoterm: 'FOB' | 'CIF' | 'EXW' | 'DDP' | 'CFR';
  portOfOrigin: string;
  portOfDestination: string;
  
  // Values
  currency: 'USD' | 'EUR' | 'CNY';
  exchangeRate: number;
  fobValue: number;            // in foreign currency
  fobValueAOA: number;
  freightCost: number;
  insuranceCost: number;
  cifValue: number;
  
  // Customs
  customsDeclarationNumber?: string;
  customsDutyRate: number;     // %
  customsDutyAmount: number;
  otherTaxes: number;
  totalCustoms: number;
  
  // Landed cost
  portCharges: number;
  transportLocal: number;
  otherCosts: number;
  totalLandedCost: number;
  costPerUnit: number;
  
  // Items
  items: ImportItem[];
  totalQuantity: number;
  
  // Status
  status: 'draft' | 'ordered' | 'shipped' | 'in_customs' | 'cleared' | 'received' | 'cancelled';
  
  // Dates
  orderDate: string;
  shippingDate?: string;
  arrivalDate?: string;
  customsClearanceDate?: string;
  receivedDate?: string;
  
  branchId: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

interface ImportItem {
  id: string;
  productId?: string;
  description: string;
  hsCode?: string;           // Harmonized System code
  quantity: number;
  unit: string;
  unitPriceForeign: number;
  unitPriceAOA: number;
  totalForeign: number;
  totalAOA: number;
  landedCostPerUnit: number;
}

const STORAGE_KEY = 'kwanzaerp_imports';
function getStored(): ImportOrder[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function setStored(data: ImportOrder[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

export default function ImportModule() {
  const { user } = useAuth();
  const { currentBranch } = useBranchContext();
  const [activeTab, setActiveTab] = useState('importacoes');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  // Form
  const [form, setForm] = useState({
    supplierName: '', supplierCountry: '', transportMode: 'sea' as ImportOrder['transportMode'],
    incoterm: 'FOB' as ImportOrder['incoterm'], portOfOrigin: '', portOfDestination: 'Luanda',
    currency: 'USD' as ImportOrder['currency'], exchangeRate: 920,
    fobValue: 0, freightCost: 0, insuranceCost: 0,
    customsDutyRate: 10, portCharges: 0, transportLocal: 0, otherCosts: 0,
    notes: '',
  });

  const refresh = () => setRefreshKey(k => k + 1);
  const orders = useMemo(() => getStored().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [refreshKey]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const q = searchTerm.toLowerCase();
    return orders.filter(o => o.orderNumber.toLowerCase().includes(q) || o.supplierName.toLowerCase().includes(q));
  }, [orders, searchTerm]);

  const summary = useMemo(() => ({
    total: orders.length,
    inTransit: orders.filter(o => o.status === 'shipped').length,
    inCustoms: orders.filter(o => o.status === 'in_customs').length,
    received: orders.filter(o => o.status === 'received').length,
    totalValue: orders.reduce((s, o) => s + o.totalLandedCost, 0),
  }), [orders]);

  const createOrder = () => {
    if (!form.supplierName) { toast.error('Fornecedor é obrigatório'); return; }
    const all = getStored();
    const seq = all.length + 1;
    const now = new Date();

    const fobAOA = form.fobValue * form.exchangeRate;
    const cifValue = form.fobValue + form.freightCost + form.insuranceCost;
    const cifAOA = cifValue * form.exchangeRate;
    const customsDuty = cifAOA * (form.customsDutyRate / 100);
    const totalCustoms = customsDuty;
    const totalLanded = cifAOA + totalCustoms + form.portCharges + form.transportLocal + form.otherCosts;

    const order: ImportOrder = {
      id: `imp_${Date.now()}`,
      orderNumber: `IMP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(seq).padStart(3, '0')}`,
      supplierName: form.supplierName,
      supplierCountry: form.supplierCountry,
      transportMode: form.transportMode,
      incoterm: form.incoterm,
      portOfOrigin: form.portOfOrigin,
      portOfDestination: form.portOfDestination,
      currency: form.currency,
      exchangeRate: form.exchangeRate,
      fobValue: form.fobValue,
      fobValueAOA: fobAOA,
      freightCost: form.freightCost,
      insuranceCost: form.insuranceCost,
      cifValue,
      customsDutyRate: form.customsDutyRate,
      customsDutyAmount: customsDuty,
      otherTaxes: 0,
      totalCustoms,
      portCharges: form.portCharges,
      transportLocal: form.transportLocal,
      otherCosts: form.otherCosts,
      totalLandedCost: totalLanded,
      costPerUnit: 0,
      items: [],
      totalQuantity: 0,
      status: 'draft',
      orderDate: now.toISOString(),
      branchId: currentBranch?.id || '',
      notes: form.notes,
      createdBy: user?.id || '',
      createdAt: now.toISOString(),
    };
    all.push(order);
    setStored(all);
    toast.success(`Importação ${order.orderNumber} criada`);
    setFormOpen(false);
    refresh();
  };

  const updateStatus = (id: string, status: ImportOrder['status']) => {
    const all = getStored();
    const idx = all.findIndex(o => o.id === id);
    if (idx >= 0) {
      all[idx].status = status;
      const now = new Date().toISOString();
      if (status === 'shipped') all[idx].shippingDate = now;
      if (status === 'in_customs') all[idx].arrivalDate = now;
      if (status === 'cleared') all[idx].customsClearanceDate = now;
      if (status === 'received') all[idx].receivedDate = now;
      setStored(all);
      refresh();
      toast.success('Estado actualizado');
    }
  };

  const selectedOrder = orders.find(o => o.id === selectedId);

  const transportIcon = (mode: string) => mode === 'sea' ? Ship : mode === 'air' ? Plane : Truck;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 border-b flex-wrap">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setFormOpen(true)}>
          <Plus className="w-3 h-3" /> Nova Importação
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        {/* Status progression */}
        {selectedOrder && selectedOrder.status !== 'received' && selectedOrder.status !== 'cancelled' && (
          <>
            {selectedOrder.status === 'draft' && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => updateStatus(selectedOrder.id, 'ordered')}>
                <ArrowRight className="w-3 h-3" /> Encomendado
              </Button>
            )}
            {selectedOrder.status === 'ordered' && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => updateStatus(selectedOrder.id, 'shipped')}>
                <Ship className="w-3 h-3" /> Expedido
              </Button>
            )}
            {selectedOrder.status === 'shipped' && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => updateStatus(selectedOrder.id, 'in_customs')}>
                <Globe className="w-3 h-3" /> Na Alfândega
              </Button>
            )}
            {selectedOrder.status === 'in_customs' && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-green-600" onClick={() => updateStatus(selectedOrder.id, 'cleared')}>
                <CheckCircle className="w-3 h-3" /> Desalfandegado
              </Button>
            )}
            {selectedOrder.status === 'cleared' && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-green-600" onClick={() => updateStatus(selectedOrder.id, 'received')}>
                <Package className="w-3 h-3" /> Recebido
              </Button>
            )}
          </>
        )}
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={refresh}><RefreshCw className="w-3 h-3" /></Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-[10px] mr-2">
          <Badge variant="outline" className="gap-1"><Globe className="w-3 h-3" /> {summary.total}</Badge>
          <Badge variant="outline" className="gap-1 text-blue-600">{summary.inTransit} em trânsito</Badge>
          <Badge variant="outline" className="gap-1 text-amber-600">{summary.inCustoms} alfândega</Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-7 text-xs pl-7 w-40" />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-auto p-0">
          {[
            { key: 'importacoes', label: 'Importações', icon: Globe },
            { key: 'custos', label: 'Landed Cost', icon: Calculator },
            { key: 'cambio', label: 'Câmbio', icon: DollarSign },
            { key: 'alfandega', label: 'Alfândega', icon: FileText },
          ].map(tab => (
            <TabsTrigger key={tab.key} value={tab.key}
              className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-1.5 gap-1">
              <tab.icon className="w-3 h-3" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="importacoes" className="flex-1 m-0 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 border-b sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold w-32">Nº Importação</th>
                <th className="px-3 py-2 text-left font-semibold">Fornecedor</th>
                <th className="px-3 py-2 text-left font-semibold w-20">País</th>
                <th className="px-3 py-2 text-center font-semibold w-14">Via</th>
                <th className="px-3 py-2 text-left font-semibold w-14">Moeda</th>
                <th className="px-3 py-2 text-right font-semibold w-24">FOB</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Custo Total (Kz)</th>
                <th className="px-3 py-2 text-center font-semibold w-24">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredOrders.map(order => {
                const TransportIcon = transportIcon(order.transportMode);
                return (
                  <tr key={order.id} className={cn("cursor-pointer hover:bg-accent/50", selectedId === order.id && "bg-primary/15")}
                    onClick={() => setSelectedId(order.id)}>
                    <td className="px-3 py-1.5 font-mono">{order.orderNumber}</td>
                    <td className="px-3 py-1.5 font-medium">{order.supplierName}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{order.supplierCountry}</td>
                    <td className="px-3 py-1.5 text-center"><TransportIcon className="w-3.5 h-3.5 inline text-muted-foreground" /></td>
                    <td className="px-3 py-1.5">{order.currency}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{order.fobValue.toLocaleString('en-US')}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium">{order.totalLandedCost.toLocaleString('pt-AO')}</td>
                    <td className="px-3 py-1.5 text-center">
                      <Badge variant={
                        order.status === 'received' ? 'default' :
                        order.status === 'shipped' || order.status === 'in_customs' ? 'secondary' :
                        order.status === 'cancelled' ? 'destructive' : 'outline'
                      } className="text-[9px] px-1.5 py-0">
                        {order.status === 'draft' ? 'Rascunho' : order.status === 'ordered' ? 'Encomendado' :
                         order.status === 'shipped' ? 'Expedido' : order.status === 'in_customs' ? 'Alfândega' :
                         order.status === 'cleared' ? 'Desalfandegado' : order.status === 'received' ? 'Recebido' : 'Cancelado'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma importação registada</p>
            </div>
          )}
        </TabsContent>

        {['custos', 'cambio', 'alfandega'].map(tab => (
          <TabsContent key={tab} value={tab} className="flex-1 m-0 p-4">
            <Card><CardContent className="pt-6 text-center text-muted-foreground">
              <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{tab === 'custos' ? 'Cálculo de Landed Cost' : tab === 'cambio' ? 'Gestão de Câmbio' : 'Documentos Alfandegários'}</p>
              <p className="text-xs mt-1">Funcionalidade em desenvolvimento</p>
            </CardContent></Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Selected info bar */}
      {selectedOrder && (
        <div className="h-7 bg-primary/10 border-t flex items-center px-3 text-[10px] gap-4">
          <span className="font-bold">{selectedOrder.orderNumber}</span>
          <span>{selectedOrder.supplierName} ({selectedOrder.supplierCountry})</span>
          <span>FOB: {selectedOrder.fobValue.toLocaleString('en-US')} {selectedOrder.currency}</span>
          <span>Taxa: {selectedOrder.exchangeRate}</span>
          <span>Custo Total: {selectedOrder.totalLandedCost.toLocaleString('pt-AO')} Kz</span>
        </div>
      )}

      {/* New Import Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Importação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Fornecedor *</Label>
                <Input value={form.supplierName} onChange={e => setForm(p => ({ ...p, supplierName: e.target.value }))} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">País</Label>
                <Input value={form.supplierCountry} onChange={e => setForm(p => ({ ...p, supplierCountry: e.target.value }))} placeholder="China, Portugal..." className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Via Transporte</Label>
                <Select value={form.transportMode} onValueChange={v => setForm(p => ({ ...p, transportMode: v as any }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sea">Marítima</SelectItem>
                    <SelectItem value="air">Aérea</SelectItem>
                    <SelectItem value="land">Terrestre</SelectItem>
                  </SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1"><Label className="text-xs">Moeda</Label>
                <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v as any }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="CNY">CNY</SelectItem></SelectContent>
                </Select></div>
              <div className="space-y-1"><Label className="text-xs">Taxa Câmbio</Label>
                <Input type="number" value={form.exchangeRate} onChange={e => setForm(p => ({ ...p, exchangeRate: Number(e.target.value) }))} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Incoterm</Label>
                <Select value={form.incoterm} onValueChange={v => setForm(p => ({ ...p, incoterm: v as any }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="FOB">FOB</SelectItem><SelectItem value="CIF">CIF</SelectItem><SelectItem value="EXW">EXW</SelectItem><SelectItem value="DDP">DDP</SelectItem></SelectContent>
                </Select></div>
              <div className="space-y-1"><Label className="text-xs">Direitos Alfânda %</Label>
                <Input type="number" value={form.customsDutyRate} onChange={e => setForm(p => ({ ...p, customsDutyRate: Number(e.target.value) }))} className="h-8 text-xs" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Valor FOB ({form.currency})</Label>
                <Input type="number" value={form.fobValue} onChange={e => setForm(p => ({ ...p, fobValue: Number(e.target.value) }))} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Frete ({form.currency})</Label>
                <Input type="number" value={form.freightCost} onChange={e => setForm(p => ({ ...p, freightCost: Number(e.target.value) }))} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Seguro ({form.currency})</Label>
                <Input type="number" value={form.insuranceCost} onChange={e => setForm(p => ({ ...p, insuranceCost: Number(e.target.value) }))} className="h-8 text-xs" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Despesas Porto (Kz)</Label>
                <Input type="number" value={form.portCharges} onChange={e => setForm(p => ({ ...p, portCharges: Number(e.target.value) }))} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Transporte Local (Kz)</Label>
                <Input type="number" value={form.transportLocal} onChange={e => setForm(p => ({ ...p, transportLocal: Number(e.target.value) }))} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Outros Custos (Kz)</Label>
                <Input type="number" value={form.otherCosts} onChange={e => setForm(p => ({ ...p, otherCosts: Number(e.target.value) }))} className="h-8 text-xs" /></div>
            </div>
            {/* Auto-calculated summary */}
            <div className="bg-muted/30 rounded p-3 text-xs space-y-1 border">
              <div className="flex justify-between"><span>CIF ({form.currency}):</span><span className="font-mono">{(form.fobValue + form.freightCost + form.insuranceCost).toLocaleString('en-US')}</span></div>
              <div className="flex justify-between"><span>CIF (Kz):</span><span className="font-mono">{((form.fobValue + form.freightCost + form.insuranceCost) * form.exchangeRate).toLocaleString('pt-AO')}</span></div>
              <div className="flex justify-between"><span>Direitos ({form.customsDutyRate}%):</span><span className="font-mono">{(((form.fobValue + form.freightCost + form.insuranceCost) * form.exchangeRate) * form.customsDutyRate / 100).toLocaleString('pt-AO')}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>Custo Total:</span>
                <span className="font-mono">{(((form.fobValue + form.freightCost + form.insuranceCost) * form.exchangeRate) * (1 + form.customsDutyRate / 100) + form.portCharges + form.transportLocal + form.otherCosts).toLocaleString('pt-AO')} Kz</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={createOrder}>Criar Importação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
