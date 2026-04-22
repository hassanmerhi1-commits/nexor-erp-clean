import React, { useState, useEffect, useMemo } from 'react';
import { useBranchContext } from '@/contexts/BranchContext';
import { useTranslation } from '@/i18n';
import { useAuth } from '@/hooks/useERP';
import { 
  getExpenses, 
  createExpense, 
  saveExpense,
  payExpense, 
  getCaixas, 
  getBankAccounts,
  ensureBranchCaixa
} from '@/lib/accountingStorage';
import { Expense, ExpenseCategory, EXPENSE_CATEGORIES, Caixa, BankAccount } from '@/types/accounting';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  MoreHorizontal, 
  Receipt, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Wallet,
  Building,
  Search,
  Filter
} from 'lucide-react';

const STATUS_CONFIG: Record<Expense['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  draft: { label: 'Rascunho', variant: 'secondary', icon: Clock },
  pending_approval: { label: 'Aguardando Aprovação', variant: 'outline', icon: Clock },
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  paid: { label: 'Pago', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Rejeitado', variant: 'destructive', icon: XCircle },
};

interface ExpenseFormData {
  category: ExpenseCategory;
  description: string;
  amount: number;
  taxAmount: number;
  paymentSource: 'caixa' | 'bank';
  caixaId: string;
  bankAccountId: string;
  payeeName: string;
  payeeNif: string;
  invoiceNumber: string;
  notes: string;
}

const initialFormData: ExpenseFormData = {
  category: 'materials',
  description: '',
  amount: 0,
  taxAmount: 0,
  paymentSource: 'caixa',
  caixaId: '',
  bankAccountId: '',
  payeeName: '',
  payeeNif: '',
  invoiceNumber: '',
  notes: '',
};

export default function Expenses() {
  const { t } = useTranslation();
  const { currentBranch } = useBranchContext();
  const { user } = useAuth();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ExpenseFormData>(initialFormData);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('__all__');
  const [categoryFilter, setCategoryFilter] = useState<string>('__all__');

  const loadData = async () => {
    // Auto-seed a default Caixa for the current branch if none exists
    if (currentBranch?.id) {
      await ensureBranchCaixa(currentBranch.id, currentBranch.name || 'Sede');
    }
    setExpenses(await getExpenses(currentBranch?.id));
    setCaixas(await getCaixas(currentBranch?.id));
    setBankAccounts(await getBankAccounts(currentBranch?.id));
  };

  useEffect(() => {
    loadData();
  }, [currentBranch?.id]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.expenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.payeeName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === '__all__' || exp.status === statusFilter;
      const matchesCategory = categoryFilter === '__all__' || exp.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [expenses, searchTerm, statusFilter, categoryFilter]);

  const handleOpenDialog = (expense?: Expense) => {
    if (expense) {
      setEditingId(expense.id);
      setFormData({
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        taxAmount: expense.taxAmount || 0,
        paymentSource: expense.paymentSource,
        caixaId: expense.caixaId || '',
        bankAccountId: expense.bankAccountId || '',
        payeeName: expense.payeeName || '',
        payeeNif: expense.payeeNif || '',
        invoiceNumber: expense.invoiceNumber || '',
        notes: expense.notes || '',
      });
    } else {
      setEditingId(null);
      setFormData({
        ...initialFormData,
        caixaId: caixas[0]?.id || '',
        bankAccountId: bankAccounts[0]?.id || '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.description.trim()) {
      toast({ title: 'Erro', description: 'Descrição é obrigatória', variant: 'destructive' });
      return;
    }
    if (formData.amount <= 0) {
      toast({ title: 'Erro', description: 'Valor deve ser maior que zero', variant: 'destructive' });
      return;
    }
    if (formData.paymentSource === 'caixa' && !formData.caixaId) {
      toast({ title: 'Erro', description: 'Seleccione uma caixa', variant: 'destructive' });
      return;
    }
    if (formData.paymentSource === 'bank' && !formData.bankAccountId) {
      toast({ title: 'Erro', description: 'Seleccione uma conta bancária', variant: 'destructive' });
      return;
    }

    if (editingId) {
      const existing = expenses.find(e => e.id === editingId);
      if (existing) {
        saveExpense({
          ...existing,
          ...formData,
          totalAmount: formData.amount + formData.taxAmount,
        });
        toast({ title: 'Sucesso', description: 'Despesa actualizada' });
      }
    } else {
      createExpense(
        currentBranch?.id || 'default',
        currentBranch?.name || 'Sede',
        currentBranch?.code || 'SEDE',
        formData.category,
        formData.description,
        formData.amount,
        formData.paymentSource,
        user?.name || 'Sistema',
        formData.caixaId || undefined,
        formData.bankAccountId || undefined,
        formData.payeeName || undefined,
        formData.taxAmount || undefined,
        formData.invoiceNumber || undefined,
        formData.notes || undefined
      );
      toast({ title: 'Sucesso', description: 'Despesa registada' });
    }

    setIsDialogOpen(false);
    loadData();
  };

  const handleApprove = (expense: Expense) => {
    saveExpense({ ...expense, status: 'approved', approvedBy: user?.name, approvedAt: new Date().toISOString() });
    toast({ title: 'Aprovado', description: `Despesa ${expense.expenseNumber} aprovada` });
    loadData();
  };

  const handleReject = (expense: Expense) => {
    saveExpense({ ...expense, status: 'rejected', approvedBy: user?.name, approvedAt: new Date().toISOString(), rejectionReason: 'Rejeitado pelo gestor' });
    toast({ title: 'Rejeitado', description: `Despesa ${expense.expenseNumber} rejeitada`, variant: 'destructive' });
    loadData();
  };

  const handlePay = (expense: Expense) => {
    payExpense(expense.id, user?.name || 'Sistema');
    toast({ title: 'Pago', description: `Despesa ${expense.expenseNumber} paga com sucesso` });
    loadData();
  };

  const handleSubmitForApproval = (expense: Expense) => {
    saveExpense({ ...expense, status: 'pending_approval' });
    toast({ title: 'Enviado', description: 'Despesa enviada para aprovação' });
    loadData();
  };

  const getCategoryLabel = (cat: ExpenseCategory) => {
    return EXPENSE_CATEGORIES.find(c => c.value === cat)?.label || cat;
  };

  const getCategoryIcon = (cat: ExpenseCategory) => {
    return EXPENSE_CATEGORIES.find(c => c.value === cat)?.icon || '📋';
  };

  // Summary stats
  const stats = useMemo(() => {
    const pending = expenses.filter(e => e.status === 'pending_approval').length;
    const totalPaid = expenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.totalAmount, 0);
    const totalPending = expenses.filter(e => ['draft', 'pending_approval', 'approved'].includes(e.status)).reduce((sum, e) => sum + e.totalAmount, 0);
    return { pending, totalPaid, totalPending, total: expenses.length };
  }, [expenses]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Despesas</h1>
          <p className="text-muted-foreground">
            Gestão de despesas operacionais - {currentBranch?.name || 'Todas as filiais'}
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Despesa
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Despesas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">Aguardando Aprovação</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">
              {stats.totalPaid.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz
            </div>
            <div className="text-sm text-muted-foreground">Total Pago</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">
              {stats.totalPending.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz
            </div>
            <div className="text-sm text-muted-foreground">Pendente</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar despesas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos Estados</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="pending_approval">Aguardando</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas Categorias</SelectItem>
                {EXPENSE_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Despesa</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Beneficiário</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Fonte Pagamento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma despesa encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map(expense => {
                  const statusConfig = STATUS_CONFIG[expense.status];
                  const StatusIcon = statusConfig.icon;
                  return (
                    <TableRow key={expense.id}>
                      <TableCell className="font-mono text-sm">{expense.expenseNumber}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span>{getCategoryIcon(expense.category)}</span>
                          <span className="text-sm">{getCategoryLabel(expense.category)}</span>
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                      <TableCell>{expense.payeeName || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {expense.totalAmount.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          {expense.paymentSource === 'caixa' ? (
                            <><Wallet className="w-3 h-3" /> Caixa</>
                          ) : (
                            <><Building className="w-3 h-3" /> Banco</>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="gap-1">
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(expense.createdAt), 'dd/MM/yyyy', { locale: pt })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border">
                            {expense.status === 'draft' && (
                              <>
                                <DropdownMenuItem onClick={() => handleOpenDialog(expense)}>
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSubmitForApproval(expense)}>
                                  Enviar para Aprovação
                                </DropdownMenuItem>
                              </>
                            )}
                            {expense.status === 'pending_approval' && (
                              <>
                                <DropdownMenuItem onClick={() => handleApprove(expense)} className="text-green-600">
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Aprovar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleReject(expense)} className="text-destructive">
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Rejeitar
                                </DropdownMenuItem>
                              </>
                            )}
                            {expense.status === 'approved' && (
                              <DropdownMenuItem onClick={() => handlePay(expense)} className="text-green-600">
                                <Receipt className="w-4 h-4 mr-2" />
                                Marcar como Pago
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
            <DialogDescription>
              Preencha os dados da despesa operacional
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as ExpenseCategory })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fonte de Pagamento *</Label>
                <Select value={formData.paymentSource} onValueChange={(v) => setFormData({ ...formData, paymentSource: v as 'caixa' | 'bank' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caixa">💵 Caixa</SelectItem>
                    <SelectItem value="bank">🏦 Conta Bancária</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.paymentSource === 'caixa' ? (
              <div className="space-y-2">
                <Label>Caixa *</Label>
                <Select value={formData.caixaId} onValueChange={(v) => setFormData({ ...formData, caixaId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione a caixa" />
                  </SelectTrigger>
                  <SelectContent>
                    {caixas.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} - Saldo: {c.currentBalance.toLocaleString('pt-AO')} Kz
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Conta Bancária *</Label>
                <Select value={formData.bankAccountId} onValueChange={(v) => setFormData({ ...formData, bankAccountId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.bankName} - {a.accountNumber} ({a.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da despesa"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (Kz) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>IVA (Kz)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.taxAmount || ''}
                  onChange={(e) => setFormData({ ...formData, taxAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Beneficiário</Label>
                <Input
                  value={formData.payeeName}
                  onChange={(e) => setFormData({ ...formData, payeeName: e.target.value })}
                  placeholder="Nome do beneficiário"
                />
              </div>
              <div className="space-y-2">
                <Label>NIF do Beneficiário</Label>
                <Input
                  value={formData.payeeNif}
                  onChange={(e) => setFormData({ ...formData, payeeNif: e.target.value })}
                  placeholder="NIF"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nº Factura/Recibo</Label>
              <Input
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                placeholder="Referência do documento"
              />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações adicionais"
                rows={2}
              />
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total a Pagar:</span>
                <span className="text-xl font-bold">
                  {(formData.amount + formData.taxAmount).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingId ? 'Guardar Alterações' : 'Registar Despesa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
