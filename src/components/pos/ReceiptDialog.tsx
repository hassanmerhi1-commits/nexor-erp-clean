import { useState } from 'react';
import { Sale, Branch } from '@/types/erp';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer, Settings, Check, FileOutput } from 'lucide-react';
import { 
  printReceipt, 
  getPrinterConfig, 
  openCashDrawer 
} from '@/lib/thermalPrinter';
import { PrinterSettingsDialog } from './PrinterSettingsDialog';
import { AGTQRCode } from '@/components/invoice/AGTQRCode';
import { getInvoiceHash } from '@/lib/agtQRCode';
import { printA4Invoice } from '@/lib/a4Invoice';
import { getCompanySettings } from '@/lib/companySettings';
import { toast } from 'sonner';

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  branch: Branch | null;
  onNewSale: () => void;
}

export function ReceiptDialog({
  open,
  onOpenChange,
  sale,
  branch,
  onNewSale,
}: ReceiptDialogProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const company = getCompanySettings();

  if (!sale || !branch) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const config = getPrinterConfig();
      const autoOpenDrawer = localStorage.getItem('kwanza_auto_open_drawer') !== 'false';
      
      const result = await printReceipt(sale, branch, config, autoOpenDrawer);
      
      if (result.success) {
        toast.success(
          result.method === 'serial' 
            ? 'Recibo enviado para impressora térmica' 
            : 'Janela de impressão aberta'
        );
      }
    } catch (error) {
      toast.error('Erro ao imprimir: ' + (error as Error).message);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleOpenDrawer = async () => {
    try {
      const success = await openCashDrawer();
      if (success) {
        toast.success('Gaveta aberta');
      } else {
        toast.info('Use o app desktop para abrir a gaveta');
      }
    } catch (error) {
      toast.error('Erro ao abrir gaveta');
    }
  };

  const handlePrintA4 = async () => {
    try {
      await printA4Invoice(sale, branch, {
        showBankDetails: true,
        showNotes: true,
        documentType: 'FR',
      });
      toast.success('Factura A4 enviada para impressão');
    } catch (error) {
      toast.error('Erro ao imprimir factura A4');
      console.error('A4 print error:', error);
    }
  };

  return (
    <>
      <PrinterSettingsDialog 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
      />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <Check className="w-5 h-5" />
            Venda Concluída
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div className="bg-white text-black rounded-lg p-4 font-mono text-xs space-y-2 print:block">
          <div className="text-center space-y-1">
            {company.logo && (
              <div className="flex justify-center mb-2">
                <img src={company.logo} alt={company.tradeName || company.name} className="max-h-12 object-contain" />
              </div>
            )}
            <h3 className="font-bold text-sm">{company.tradeName || company.name}</h3>
            <p>{company.address}</p>
            <p>{company.city}{company.province ? `, ${company.province}` : ''}</p>
            <p>Tel: {company.phone}</p>
            <p className="text-[10px]">NIF: {company.nif}</p>
            <p className="text-[10px] text-gray-500">{branch.name}</p>
          </div>

          <Separator className="border-dashed" />

          <div className="text-center">
            <p className="font-bold">{sale.invoiceNumber}</p>
            <p>{new Date(sale.createdAt).toLocaleString('pt-AO')}</p>
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
            {company.exchangeRateUSD && company.exchangeRateUSD > 0 && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Equiv. USD</span>
                <span>$ {(sale.total / company.exchangeRateUSD).toFixed(2)}</span>
              </div>
            )}
            {company.exchangeRateEUR && company.exchangeRateEUR > 0 && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Equiv. EUR</span>
                <span>€ {(sale.total / company.exchangeRateEUR).toFixed(2)}</span>
              </div>
            )}
          </div>

          <Separator className="border-dashed" />

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Pagamento</span>
              <span className="uppercase">{sale.paymentMethod}</span>
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
                {sale.customerNif && (
                  <div className="flex justify-between">
                    <span>NIF Cliente</span>
                    <span>{sale.customerNif}</span>
                  </div>
                )}
                {sale.customerName && (
                  <div className="flex justify-between">
                    <span>Cliente</span>
                    <span>{sale.customerName}</span>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator className="border-dashed" />

          {/* AGT QR Code - Required by Executive Decree 683/25 */}
          <div className="py-2">
            <AGTQRCode 
              sale={sale} 
              branch={branch} 
              size={100}
              showVerificationText={true}
            />
          </div>

          <Separator className="border-dashed" />

          <div className="text-center text-[10px] space-y-1">
            <p>Documento processado por {company.tradeName || company.name}</p>
            <p>Software certificado AGT</p>
            <p>{company.footerText || 'Obrigado pela preferência!'}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 print:hidden">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={isPrinting}
            >
              <Printer className="w-4 h-4 mr-2" />
              {isPrinting ? 'Imprimindo...' : 'Térmico'}
            </Button>
            <Button variant="outline" onClick={handlePrintA4}>
              <FileOutput className="w-4 h-4 mr-2" />
              A4
            </Button>
          </div>

          <Button className="w-full" onClick={onNewSale}>
            Nova Venda
          </Button>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-muted-foreground"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Config. Impressora
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
