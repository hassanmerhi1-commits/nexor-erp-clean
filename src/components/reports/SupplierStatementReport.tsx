import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSuppliers, usePurchaseOrders } from '@/hooks/useERP';
import { Download, Printer, Truck, Search } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { exportToExcel } from '@/lib/excel';

interface SupplierEntry {
  id: string;
  date: string;
  type: 'purchase' | 'payment' | 'credit_note' | 'debit_note';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function SupplierStatementReport() {
  const { suppliers } = useSuppliers();
  const { orders } = usePurchaseOrders();
  
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');

  const selectedSupplierData = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplier);
  }, [suppliers, selectedSupplier]);

  const statementEntries = useMemo((): SupplierEntry[] => {
    if (!selectedSupplier) return [];
    
    // Get purchase orders for this supplier
    const supplierPOs = orders.filter(order => {
      const orderDate = order.createdAt.split('T')[0];
      const matchesSupplier = order.supplierId === selectedSupplier;
      const matchesDate = orderDate >= dateFrom && orderDate <= dateTo;
      const matchesStatus = order.status === 'received' || order.status === 'partial';
      return matchesSupplier && matchesDate && matchesStatus;
    });

    let runningBalance = 0;
    
    // Create statement entries from POs (credits - we owe supplier)
    const entries: SupplierEntry[] = supplierPOs
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(po => {
        const credit = po.total; // We owe supplier
        runningBalance = runningBalance + credit;
        
        return {
          id: po.id,
          date: po.createdAt,
          type: 'purchase' as const,
          reference: po.orderNumber,
          description: `Compra - ${po.items.length} item(s)`,
          debit: 0,
          credit: credit,
          balance: runningBalance,
        };
      });

    return entries;
  }, [selectedSupplier, orders, dateFrom, dateTo]);

  const totals = useMemo(() => {
    return statementEntries.reduce((acc, entry) => ({
      debit: acc.debit + entry.debit,
      credit: acc.credit + entry.credit,
    }), { debit: 0, credit: 0 });
  }, [statementEntries]);

  // Calculate total debt per supplier
  const supplierDebts = useMemo(() => {
    const debts: Record<string, number> = {};
    orders
      .filter(o => o.status === 'received' || o.status === 'partial')
      .forEach(order => {
        debts[order.supplierId] = (debts[order.supplierId] || 0) + order.total;
      });
    return debts;
  }, [orders]);

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(term) || 
      s.nif.toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-AO', { 
      style: 'currency', 
      currency: 'AOA',
      minimumFractionDigits: 2 
    }).format(value);
  };

  const handleExport = () => {
    if (!selectedSupplierData) return;
    
    const data = statementEntries.map(entry => ({
      'Data': format(parseISO(entry.date), 'dd/MM/yyyy'),
      'Tipo': entry.type === 'purchase' ? 'Compra' : 
              entry.type === 'payment' ? 'Pagamento' :
              entry.type === 'credit_note' ? 'Nota Crédito' : 'Nota Débito',
      'Referência': entry.reference,
      'Descrição': entry.description,
      'Débito': entry.debit,
      'Crédito': entry.credit,
      'Saldo': entry.balance,
    }));
    
    exportToExcel(data, `ContaCorrente_${selectedSupplierData.name}_${format(new Date(), 'yyyyMMdd')}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Conta Corrente - Fornecedor
          </CardTitle>
          <CardDescription>
            Movimentos de compras e pagamentos por fornecedor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label>Fornecedor</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar fornecedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 mb-2"
                />
              </div>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSuppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.nif}) - Dívida: {formatCurrency(supplierDebts[supplier.id] || 0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Início</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          
          {selectedSupplierData && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Fornecedor</p>
                  <p className="font-semibold">{selectedSupplierData.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">NIF</p>
                  <p className="font-semibold">{selectedSupplierData.nif}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contacto</p>
                  <p className="font-semibold">{selectedSupplierData.contactPerson || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prazo Pagamento</p>
                  <p className="font-semibold">{selectedSupplierData.paymentTerms.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Devedor</p>
                  <p className="font-semibold text-orange-500">
                    {formatCurrency(supplierDebts[selectedSupplier] || 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statement Table */}
      {selectedSupplier && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Movimentos</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Débito (Pagto)</TableHead>
                  <TableHead className="text-right">Crédito (Compra)</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statementEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum movimento encontrado para o período seleccionado
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {statementEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {format(parseISO(entry.date), 'dd/MM/yyyy', { locale: pt })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.type === 'purchase' ? 'default' : 
                                         entry.type === 'payment' ? 'secondary' : 'outline'}>
                            {entry.type === 'purchase' ? 'Compra' : 
                             entry.type === 'payment' ? 'Pagamento' :
                             entry.type === 'credit_note' ? 'NC' : 'ND'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{entry.reference}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right text-green-500">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-orange-500">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-orange-500">
                          {formatCurrency(entry.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={4}>TOTAIS</TableCell>
                      <TableCell className="text-right text-green-500">
                        {formatCurrency(totals.debit)}
                      </TableCell>
                      <TableCell className="text-right text-orange-500">
                        {formatCurrency(totals.credit)}
                      </TableCell>
                      <TableCell className="text-right text-orange-500">
                        {formatCurrency(totals.credit - totals.debit)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
