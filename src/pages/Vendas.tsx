import { useState, useMemo, useCallback } from 'react';
import { useSales, useAuth } from '@/hooks/useERP';
import { useBranchContext } from '@/contexts/BranchContext';
import { Sale } from '@/types/erp';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Search, Printer, FileOutput, Eye, RefreshCw, ShoppingCart,
  Calendar, DollarSign, CreditCard, Banknote, ArrowRightLeft,
  Receipt, Check, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { printA4Invoice } from '@/lib/a4Invoice';
import { printReceipt, getPrinterConfig } from '@/lib/thermalPrinter';
import { getCompanySettings } from '@/lib/companySettings';
import { AGTQRCode } from '@/components/invoice/AGTQRCode';
import { toast } from 'sonner';

const paymentLabels: Record<string, { label: string; icon: any; color: string }> = {
  cash: { label: 'Numerário', icon: Banknote, color: 'text-success' },
  card: { label: 'Cartão', icon: CreditCard, color: 'text-info' },
  transfer: { label: 'Transferência', icon: ArrowRightLeft, color: 'text-primary' },
  mixed: { label: 'Misto', icon: DollarSign, color: 'text-warning' },
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  completed: { label: 'Concluída', variant: 'default' },
  voided: { label: 'Anulada', variant: 'destructive' },
  pending: { label: 'Pendente', variant: 'secondary' },
};

export default function Vendas() {
  const { currentBranch } = useBranchContext();
  const { sales, refreshSales } = useSales(currentBranch?.id);
  const company = getCompanySettings();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filteredSales = useMemo(() => {
    const sorted = [...sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (!searchTerm) return sorted;
    const q = searchTerm.toLowerCase();
    return sorted.filter(s =>
      s.invoiceNumber.toLowerCase().includes(q) ||
      (s.customerName && s.customerName.toLowerCase().includes(q)) ||
      (s.customerNif && s.customerNif.includes(q))
    );
  }, [sales, searchTerm]);

  const totals = useMemo(() => ({
    count: filteredSales.length,
    total: filteredSales.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.total, 0),
    cash: filteredSales.filter(s => s.paymentMethod === 'cash' && s.status === 'completed').reduce((sum, s) => sum + s.total, 0),
    card: filteredSales.filter(s => s.paymentMethod === 'card' && s.status === 'completed').reduce((sum, s) => sum + s.total, 0),
  }), [filteredSales]);

  const openDetail = useCallback((sale: Sale) => {
    setSelectedSale(sale);
    setDetailOpen(true);
  }, []);

  const handleReprintThermal = async (sale: Sale) => {
    if (!currentBranch) return;
    try {
      const config = getPrinterConfig();
      await printReceipt(sale, currentBranch, config, false);
      toast.success('Recibo enviado para impressão');
    } catch {
      toast.error('Erro ao imprimir recibo');
    }
  };

  const handleReprintA4 = async (sale: Sale) => {
    if (!currentBranch) return;
    try {
      await printA4Invoice(sale, currentBranch, { showBankDetails: true, documentType: 'FR' });
      toast.success('Factura A4 enviada para impressão');
    } catch {
      toast.error('Erro ao imprimir factura A4');
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl gradient-primary shadow-md">
            <Receipt className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Vendas</h1>
            <p className="text-xs text-muted-foreground">{currentBranch?.name}</p>
          </div>
        </div>

        <div className="w-px h-8 bg-border mx-2" />

        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refreshSales()}>
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </Button>

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar nº fatura, cliente, NIF..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-8 text-xs pl-8 w-64"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 p-3">
        {[
          { label: 'Total Vendas', value: totals.count, icon: ShoppingCart, gradient: 'gradient-primary' },
          { label: 'Valor Total', value: `${totals.total.toLocaleString('pt-AO')} Kz`, icon: DollarSign, gradient: 'gradient-success' },
          { label: 'Numerário', value: `${totals.cash.toLocaleString('pt-AO')} Kz`, icon: Banknote, gradient: 'gradient-warm' },
          { label: 'Cartão', value: `${totals.card.toLocaleString('pt-AO')} Kz`, icon: CreditCard, gradient: 'gradient-accent' },
        ].map((stat, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${stat.gradient} shadow-md`}>
                  <stat.icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className="text-xl font-extrabold tracking-tight">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales Table */}
      <div className="flex-1 overflow-auto px-3 pb-3">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 border-b sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-semibold w-36">Nº Factura</th>
              <th className="px-3 py-2 text-left font-semibold w-28">Data</th>
              <th className="px-3 py-2 text-left font-semibold w-20">Hora</th>
              <th className="px-3 py-2 text-left font-semibold">Cliente</th>
              <th className="px-3 py-2 text-left font-semibold w-24">NIF</th>
              <th className="px-3 py-2 text-center font-semibold w-24">Pagamento</th>
              <th className="px-3 py-2 text-right font-semibold w-20">Itens</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Total</th>
              <th className="px-3 py-2 text-center font-semibold w-20">Estado</th>
              <th className="px-3 py-2 text-center font-semibold w-32">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredSales.map(sale => {
              const pay = paymentLabels[sale.paymentMethod] || paymentLabels.cash;
              const status = statusConfig[sale.status] || statusConfig.completed;
              const PayIcon = pay.icon;
              return (
                <tr
                  key={sale.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => openDetail(sale)}
                >
                  <td className="px-3 py-2 font-mono font-medium">{sale.invoiceNumber}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {format(new Date(sale.createdAt), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {format(new Date(sale.createdAt), 'HH:mm')}
                  </td>
                  <td className="px-3 py-2">{sale.customerName || 'Consumidor Final'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{sale.customerNif || '999999990'}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <PayIcon className={`w-3.5 h-3.5 ${pay.color}`} />
                      <span className="text-[10px]">{pay.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{sale.items.length}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{sale.total.toLocaleString('pt-AO')} Kz</td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">{status.label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(sale)} title="Ver detalhes">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReprintThermal(sale)} title="Reimprimir recibo">
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReprintA4(sale)} title="Reimprimir A4">
                        <FileOutput className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filteredSales.length > 0 && (
            <tfoot className="bg-muted/80 border-t-2 border-primary/30">
              <tr className="font-bold text-xs">
                <td className="px-3 py-2" colSpan={7}>TOTAL ({totals.count} vendas)</td>
                <td className="px-3 py-2 text-right font-mono">{totals.total.toLocaleString('pt-AO')} Kz</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>

        {filteredSales.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma venda encontrada</p>
            <p className="text-xs mt-1">As vendas realizadas no POS aparecerão aqui</p>
          </div>
        )}
      </div>

      {/* Sale Detail Dialog */}
      <SaleDetailDialog
        sale={selectedSale}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        branch={currentBranch}
        company={company}
        onReprintThermal={handleReprintThermal}
        onReprintA4={handleReprintA4}
      />
    </div>
  );
}

// ============ Sale Detail Dialog ============
function SaleDetailDialog({
  sale, open, onOpenChange, branch, company, onReprintThermal, onReprintA4,
}: {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: any;
  company: any;
  onReprintThermal: (sale: Sale) => void;
  onReprintA4: (sale: Sale) => void;
}) {
  if (!sale) return null;

  const pay = paymentLabels[sale.paymentMethod] || paymentLabels.cash;
  const PayIcon = pay.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            {sale.invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        {/* Receipt-style preview */}
        <div className="bg-white text-black rounded-lg p-4 font-mono text-xs space-y-2 border">
          <div className="text-center space-y-1">
            {company.logo && (
              <div className="flex justify-center mb-2">
                <img src={company.logo} alt={company.tradeName || company.name} className="max-h-12 object-contain" />
              </div>
            )}
            <h3 className="font-bold text-sm">{company.tradeName || company.name}</h3>
            <p>{company.address}</p>
            <p>Tel: {company.phone}</p>
            <p className="text-[10px]">NIF: {company.nif}</p>
          </div>

          <Separator className="border-dashed" />

          <div className="text-center">
            <p className="font-bold">{sale.invoiceNumber}</p>
            <p>{format(new Date(sale.createdAt), "dd/MM/yyyy 'às' HH:mm:ss")}</p>
          </div>

          <Separator className="border-dashed" />

          {/* Items */}
          <div className="space-y-1">
            {sale.items.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <div className="flex-1">
                  <p className="truncate">{item.productName}</p>
                  <p className="text-[10px] text-gray-600">
                    {item.quantity} x {item.unitPrice.toLocaleString('pt-AO')}
                  </p>
                </div>
                <span>{item.subtotal.toLocaleString('pt-AO')}</span>
              </div>
            ))}
          </div>

          <Separator className="border-dashed" />

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{sale.subtotal.toLocaleString('pt-AO')} Kz</span>
            </div>
            <div className="flex justify-between">
              <span>IVA 14%</span>
              <span>{sale.taxAmount.toLocaleString('pt-AO')} Kz</span>
            </div>
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL</span>
              <span>{sale.total.toLocaleString('pt-AO')} Kz</span>
            </div>
          </div>

          <Separator className="border-dashed" />

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span>Pagamento</span>
              <div className="flex items-center gap-1">
                <PayIcon className={`w-3 h-3 ${pay.color}`} />
                <span>{pay.label}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span>Recebido</span>
              <span>{sale.amountPaid.toLocaleString('pt-AO')} Kz</span>
            </div>
            {sale.change > 0 && (
              <div className="flex justify-between font-bold">
                <span>Troco</span>
                <span>{sale.change.toLocaleString('pt-AO')} Kz</span>
              </div>
            )}
          </div>

          {(sale.customerNif || sale.customerName) && (
            <>
              <Separator className="border-dashed" />
              <div className="space-y-1">
                {sale.customerName && (
                  <div className="flex justify-between">
                    <span>Cliente</span>
                    <span>{sale.customerName}</span>
                  </div>
                )}
                {sale.customerNif && (
                  <div className="flex justify-between">
                    <span>NIF</span>
                    <span>{sale.customerNif}</span>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator className="border-dashed" />

          {branch && (
            <div className="py-2">
              <AGTQRCode sale={sale} branch={branch} size={80} showVerificationText />
            </div>
          )}

          <div className="text-center text-[10px] space-y-1">
            <p>Documento processado por {company.tradeName || company.name}</p>
            <p>{company.footerText || 'Obrigado pela preferência!'}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="outline" onClick={() => onReprintThermal(sale)} className="gap-2">
            <Printer className="w-4 h-4" /> Recibo Térmico
          </Button>
          <Button variant="outline" onClick={() => onReprintA4(sale)} className="gap-2">
            <FileOutput className="w-4 h-4" /> Factura A4
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
