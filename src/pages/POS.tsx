import { useState, useCallback, useRef, useMemo } from 'react';
import { useProducts, useCart, useSales, useAuth } from '@/hooks/useERP';
import { useBranchContext } from '@/contexts/BranchContext';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useKeyboardShortcuts, KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { Sale, Product } from '@/types/erp';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { CheckoutDialog } from '@/components/pos/CheckoutDialog';
import { ReceiptDialog } from '@/components/pos/ReceiptDialog';
import { BranchSelector } from '@/components/BranchSelector';
import { Search, ScanBarcode, Keyboard } from 'lucide-react';
import { toast } from 'sonner';

export default function POS() {
  const { currentBranch } = useBranchContext();
  const { products, refreshProducts } = useProducts(currentBranch?.id);
  const { user } = useAuth();
  const cart = useCart();
  const { completeSale } = useSales(currentBranch?.id);

  const [searchTerm, setSearchTerm] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle barcode scan
  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      // Don't process if user is typing in the search input
      if (document.activeElement === searchInputRef.current) {
        return;
      }

      const product = products.find(
        (p) =>
          p.isActive &&
          p.stock > 0 &&
          (p.barcode === barcode ||
            p.sku.toLowerCase() === barcode.toLowerCase())
      );

      if (product) {
        cart.addItem(product);
        setLastScannedBarcode(barcode);
        toast.success(`${product.name} adicionado`, {
          description: `Código: ${barcode}`,
        });
        // Clear indicator after 2 seconds
        setTimeout(() => setLastScannedBarcode(null), 2000);
      } else {
        toast.error('Produto não encontrado', {
          description: `Código: ${barcode}`,
        });
      }
    },
    [products, cart]
  );

  useBarcodeScanner({ onScan: handleBarcodeScan });

  const handleCheckout = useCallback(() => {
    if (cart.items.length > 0) {
      setCheckoutOpen(true);
    } else {
      toast.info('Carrinho vazio', { description: 'Adicione produtos para finalizar' });
    }
  }, [cart.items.length]);

  const handleClearCart = useCallback(() => {
    if (cart.items.length > 0) {
      cart.clearCart();
      toast.info('Carrinho limpo');
    }
  }, [cart]);

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      {
        key: 'F12',
        action: handleCheckout,
        description: 'Finalizar venda',
      },
      {
        key: 'Escape',
        action: handleClearCart,
        description: 'Limpar carrinho',
      },
      {
        key: 'F2',
        action: focusSearch,
        description: 'Pesquisar produto',
      },
      {
        key: '+',
        action: () => {
          if (cart.items.length > 0) {
            const lastItem = cart.items[cart.items.length - 1];
            cart.updateQuantity(lastItem.product.id, lastItem.quantity + 1);
          }
        },
        description: 'Aumentar quantidade do último item',
      },
      {
        key: '-',
        action: () => {
          if (cart.items.length > 0) {
            const lastItem = cart.items[cart.items.length - 1];
            if (lastItem.quantity > 1) {
              cart.updateQuantity(lastItem.product.id, lastItem.quantity - 1);
            }
          }
        },
        description: 'Diminuir quantidade do último item',
      },
      {
        key: 'Delete',
        action: () => {
          if (cart.items.length > 0) {
            const lastItem = cart.items[cart.items.length - 1];
            cart.removeItem(lastItem.product.id);
            toast.info(`${lastItem.product.name} removido`);
          }
        },
        description: 'Remover último item',
      },
    ],
    [handleCheckout, handleClearCart, focusSearch, cart]
  );

  useKeyboardShortcuts({ shortcuts, enabled: !checkoutOpen && !receiptOpen });

  const handleCompleteSale = async (
    paymentMethod: Sale['paymentMethod'],
    amountPaid: number,
    customerNif?: string,
    customerName?: string,
  ) => {
    if (!currentBranch || !user) return;

    try {
      const sale = await completeSale(
        cart.items,
        currentBranch.code,
        currentBranch.id,
        user.id,
        paymentMethod,
        amountPaid,
        customerNif,
        customerName,
      );

      setLastSale(sale);
      setCheckoutOpen(false);
      setReceiptOpen(true);
      refreshProducts();
      
      // Show feedback for cash payments
      if (paymentMethod === 'cash') {
        toast.info('Venda concluída', {
          description: 'Pagamento em dinheiro registado',
        });
      }
    } catch (error) {
      console.error('Failed to complete sale:', error);
      toast.error('Erro ao finalizar venda');
    }
  };

  const handleNewSale = () => {
    cart.clearCart();
    setReceiptOpen(false);
    setLastSale(null);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Products Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <BranchSelector compact />
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Pesquisar produto por nome, SKU ou código de barras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant={lastScannedBarcode ? 'default' : 'outline'} className="flex items-center gap-1.5 py-1.5 px-3">
              <ScanBarcode className="w-4 h-4" />
              {lastScannedBarcode ? lastScannedBarcode : 'Scanner Pronto'}
            </Badge>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <Keyboard className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Atalhos de Teclado</h4>
                  <div className="space-y-1.5 text-sm">
                    {shortcuts.map((s) => (
                      <div key={s.key} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{s.description}</span>
                        <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                          {s.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <ProductGrid
            products={products}
            onProductSelect={(product) => cart.addItem(product)}
            searchTerm={searchTerm}
          />
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 border-l bg-card flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Carrinho de Compras</h2>
          <p className="text-xs text-muted-foreground">{currentBranch?.name}</p>
        </div>
        <div className="flex-1 p-4 overflow-hidden">
          <Cart
            items={cart.items}
            subtotal={cart.subtotal}
            taxAmount={cart.taxAmount}
            total={cart.total}
            onUpdateQuantity={cart.updateQuantity}
            onRemoveItem={cart.removeItem}
            onCheckout={handleCheckout}
          />
        </div>
      </div>

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        items={cart.items}
        total={cart.total}
        taxAmount={cart.taxAmount}
        onCompleteSale={handleCompleteSale}
      />

      {/* Receipt Dialog */}
      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        sale={lastSale}
        branch={currentBranch}
        onNewSale={handleNewSale}
      />
    </div>
  );
}
