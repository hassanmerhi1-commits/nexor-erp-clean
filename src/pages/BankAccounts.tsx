import React, { useState, useEffect, useMemo } from 'react';
import { useBranchContext } from '@/contexts/BranchContext';
import { useTranslation } from '@/i18n';
import { useAuth } from '@/hooks/useERP';
import { 
  getBankAccounts, 
  createBankAccount, 
  saveBankAccount,
  getBankTransactions
} from '@/lib/accountingStorage';
import { BankAccount, BankTransaction } from '@/types/accounting';
import { MoneyTransferDialog } from '@/components/accounting/MoneyTransferDialog';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Building2, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight,
  Star,
  Edit,
  Eye,
  Banknote,
  ArrowRightLeft
} from 'lucide-react';

const ANGOLAN_BANKS = [
  'BAI - Banco Angolano de Investimentos',
  'BFA - Banco de Fomento Angola',
  'BIC - Banco BIC',
  'BPC - Banco de Poupança e Crédito',
  'BMA - Banco Millennium Atlântico',
  'Banco Keve',
  'Standard Bank Angola',
  'Banco Sol',
  'Banco Yetu',
  'BNI - Banco de Negócios Internacional',
  'Finibanco Angola',
  'Banco VTB África',
  'Outro',
];

const CURRENCIES = [
  { value: 'AOA', label: 'Kz - Kwanza Angolano' },
  { value: 'USD', label: '$ - Dólar Americano' },
  { value: 'EUR', label: '€ - Euro' },
];

interface AccountFormData {
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  swift: string;
  currency: 'AOA' | 'USD' | 'EUR';
  openingBalance: number;
  isPrimary: boolean;
}

const initialFormData: AccountFormData = {
  bankName: ANGOLAN_BANKS[0],
  accountName: '',
  accountNumber: '',
  iban: '',
  swift: '',
  currency: 'AOA',
  openingBalance: 0,
  isPrimary: false,
};

export default function BankAccounts() {
  const { t } = useTranslation();
  const { currentBranch } = useBranchContext();
  const { user } = useAuth();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState<AccountFormData>(initialFormData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customBankName, setCustomBankName] = useState('');

  const loadData = async () => {
    setAccounts(await getBankAccounts(currentBranch?.id));
    setTransactions(await getBankTransactions());
  };

  useEffect(() => {
    loadData();
  }, [currentBranch?.id]);

  const accountTransactions = useMemo(() => {
    if (!selectedAccount) return [];
    return transactions.filter(t => t.bankAccountId === selectedAccount.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedAccount, transactions]);

  const stats = useMemo(() => {
    const totalAOA = accounts.filter(a => a.currency === 'AOA').reduce((sum, a) => sum + a.currentBalance, 0);
    const totalUSD = accounts.filter(a => a.currency === 'USD').reduce((sum, a) => sum + a.currentBalance, 0);
    const totalEUR = accounts.filter(a => a.currency === 'EUR').reduce((sum, a) => sum + a.currentBalance, 0);
    const activeCount = accounts.filter(a => a.isActive).length;
    return { totalAOA, totalUSD, totalEUR, activeCount, total: accounts.length };
  }, [accounts]);

  const handleOpenDialog = (account?: BankAccount) => {
    if (account) {
      setEditingId(account.id);
      const isCustomBank = !ANGOLAN_BANKS.includes(account.bankName);
      setFormData({
        bankName: isCustomBank ? 'Outro' : account.bankName,
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        iban: account.iban || '',
        swift: account.swift || '',
        currency: account.currency,
        openingBalance: account.currentBalance,
        isPrimary: account.isPrimary || false,
      });
      if (isCustomBank) setCustomBankName(account.bankName);
    } else {
      setEditingId(null);
      setFormData({
        ...initialFormData,
        isPrimary: accounts.length === 0,
      });
      setCustomBankName('');
    }
    setIsDialogOpen(true);
  };

  const handleViewAccount = (account: BankAccount) => {
    setSelectedAccount(account);
    setIsViewDialogOpen(true);
  };

  const handleSave = () => {
    const bankName = formData.bankName === 'Outro' ? customBankName : formData.bankName;
    
    if (!bankName.trim()) {
      toast({ title: 'Erro', description: 'Nome do banco é obrigatório', variant: 'destructive' });
      return;
    }
    if (!formData.accountNumber.trim()) {
      toast({ title: 'Erro', description: 'Número da conta é obrigatório', variant: 'destructive' });
      return;
    }

    if (editingId) {
      const existing = accounts.find(a => a.id === editingId);
      if (existing) {
        saveBankAccount({
          ...existing,
          bankName,
          accountName: formData.accountName,
          accountNumber: formData.accountNumber,
          iban: formData.iban || undefined,
          swift: formData.swift || undefined,
          currency: formData.currency,
          isPrimary: formData.isPrimary,
        });
        
        // If setting as primary, unset others
        if (formData.isPrimary) {
          accounts.forEach(a => {
            if (a.id !== editingId && a.isPrimary && a.branchId === currentBranch?.id) {
              saveBankAccount({ ...a, isPrimary: false });
            }
          });
        }
        
        toast({ title: 'Sucesso', description: 'Conta bancária actualizada' });
      }
    } else {
      createBankAccount(
        currentBranch?.id || 'default',
        currentBranch?.name || 'Sede',
        bankName,
        formData.accountName,
        formData.accountNumber,
        formData.currency,
        formData.openingBalance,
        formData.iban || undefined
      );
      toast({ title: 'Sucesso', description: 'Conta bancária criada' });
    }

    setIsDialogOpen(false);
    loadData();
  };

  const toggleAccountStatus = (account: BankAccount) => {
    saveBankAccount({ ...account, isActive: !account.isActive });
    toast({ 
      title: account.isActive ? 'Desactivada' : 'Activada', 
      description: `Conta ${account.accountNumber} ${account.isActive ? 'desactivada' : 'activada'}` 
    });
    loadData();
  };

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'USD': return '$';
      case 'EUR': return '€';
      default: return 'Kz';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contas Bancárias</h1>
          <p className="text-muted-foreground">
            Gestão de contas bancárias por filial - {currentBranch?.name || 'Todas as filiais'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsTransferDialogOpen(true)} className="gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Transferência
          </Button>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Conta
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Contas</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">
              {stats.totalAOA.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz
            </div>
            <div className="text-sm text-muted-foreground">Saldo AOA</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-accent-foreground">
              $ {stats.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-muted-foreground">Saldo USD</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-secondary-foreground">
              € {stats.totalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-muted-foreground">Saldo EUR</div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <Banknote className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma conta bancária</h3>
              <p className="text-muted-foreground mb-4">
                Adicione contas bancárias para gerir os fundos da filial
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Conta
              </Button>
            </CardContent>
          </Card>
        ) : (
          accounts.map(account => (
            <Card key={account.id} className={!account.isActive ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {account.bankName.split(' - ')[0]}
                        {account.isPrimary && (
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {account.accountNumber}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={account.isActive ? 'default' : 'secondary'}>
                    {account.currency}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo Actual</p>
                    <p className="text-2xl font-bold">
                      {getCurrencySymbol(account.currency)} {account.currentBalance.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {account.iban && (
                    <div>
                      <p className="text-xs text-muted-foreground">IBAN</p>
                      <p className="text-sm font-mono">{account.iban}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewAccount(account)}>
                      <Eye className="w-4 h-4 mr-1" />
                      Ver
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenDialog(account)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}</DialogTitle>
            <DialogDescription>
              Configure os dados da conta bancária
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Banco *</Label>
              <Select value={formData.bankName} onValueChange={(v) => setFormData({ ...formData, bankName: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANGOLAN_BANKS.map(bank => (
                    <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.bankName === 'Outro' && (
              <div className="space-y-2">
                <Label>Nome do Banco *</Label>
                <Input
                  value={customBankName}
                  onChange={(e) => setCustomBankName(e.target.value)}
                  placeholder="Nome do banco"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Nome da Conta</Label>
              <Input
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                placeholder="Ex: Conta Operacional, Conta Salários"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número da Conta *</Label>
                <Input
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  placeholder="Número da conta"
                />
              </div>
              <div className="space-y-2">
                <Label>Moeda</Label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v as 'AOA' | 'USD' | 'EUR' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                placeholder="AO06 0000 0000 0000 0000 0000 0"
              />
            </div>

            <div className="space-y-2">
              <Label>SWIFT / BIC</Label>
              <Input
                value={formData.swift}
                onChange={(e) => setFormData({ ...formData, swift: e.target.value.toUpperCase() })}
                placeholder="BAIAAOLU"
              />
            </div>

            {!editingId && (
              <div className="space-y-2">
                <Label>Saldo Inicial</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.openingBalance || ''}
                  onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <Label>Conta Principal</Label>
                <p className="text-xs text-muted-foreground">Definir como conta principal da filial</p>
              </div>
              <Switch
                checked={formData.isPrimary}
                onCheckedChange={(v) => setFormData({ ...formData, isPrimary: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingId ? 'Guardar Alterações' : 'Criar Conta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Account Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {selectedAccount?.bankName}
              {selectedAccount?.isPrimary && (
                <Badge variant="outline" className="ml-2">
                  <Star className="w-3 h-3 mr-1" />
                  Principal
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Conta: {selectedAccount?.accountNumber} | {selectedAccount?.currency}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="transactions">Movimentos</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Saldo Actual</p>
                  <p className="text-3xl font-bold">
                    {getCurrencySymbol(selectedAccount?.currency || 'AOA')} {selectedAccount?.currentBalance.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Movimentos</p>
                  <p className="text-3xl font-bold">{accountTransactions.length}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Banco</span>
                  <span className="font-medium">{selectedAccount?.bankName}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Nº Conta</span>
                  <span className="font-medium font-mono">{selectedAccount?.accountNumber}</span>
                </div>
                {selectedAccount?.iban && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">IBAN</span>
                    <span className="font-medium font-mono text-sm">{selectedAccount.iban}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Filial</span>
                  <span className="font-medium">{selectedAccount?.branchName}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Criada em</span>
                  <span className="font-medium">
                    {selectedAccount?.createdAt && format(new Date(selectedAccount.createdAt), 'dd/MM/yyyy HH:mm', { locale: pt })}
                  </span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="transactions">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum movimento registado
                      </TableCell>
                    </TableRow>
                  ) : (
                    accountTransactions.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">
                          {format(new Date(tx.createdAt), 'dd/MM/yyyy', { locale: pt })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.direction === 'in' ? 'default' : 'secondary'}>
                            {tx.direction === 'in' ? (
                              <ArrowDownRight className="w-3 h-3 mr-1" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 mr-1" />
                            )}
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>
                        <TableCell className={`text-right font-medium ${tx.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.direction === 'in' ? '+' : '-'}{tx.amount.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.balanceAfter.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Money Transfer Dialog */}
      <MoneyTransferDialog
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
        onTransferComplete={loadData}
      />
    </div>
  );
}
