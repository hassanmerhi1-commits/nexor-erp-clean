import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  PieChart, Plus, Edit, Target, TrendingUp, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

// Demo data
const DEMO_COST_CENTERS = [
  { id: '1', code: 'ADM', name: 'Administração', is_active: true, description: 'Custos administrativos gerais' },
  { id: '2', code: 'COM', name: 'Comercial', is_active: true, description: 'Departamento de vendas' },
  { id: '3', code: 'LOG', name: 'Logística', is_active: true, description: 'Armazém e transporte' },
  { id: '4', code: 'PRD', name: 'Produção', is_active: true, description: 'Linha de produção' },
  { id: '5', code: 'TI', name: 'Tecnologia', is_active: true, description: 'Infraestrutura e sistemas' },
];

const DEMO_BUDGETS = [
  { id: '1', cost_center_code: 'ADM', cost_center_name: 'Administração', period_month: 3, budget_amount: 500000, actual_amount: 420000, utilization_pct: 84 },
  { id: '2', cost_center_code: 'COM', cost_center_name: 'Comercial', period_month: 3, budget_amount: 800000, actual_amount: 750000, utilization_pct: 93.8 },
  { id: '3', cost_center_code: 'LOG', cost_center_name: 'Logística', period_month: 3, budget_amount: 1200000, actual_amount: 980000, utilization_pct: 81.7 },
  { id: '4', cost_center_code: 'PRD', cost_center_name: 'Produção', period_month: 3, budget_amount: 2000000, actual_amount: 2150000, utilization_pct: 107.5 },
  { id: '5', cost_center_code: 'TI', cost_center_name: 'Tecnologia', period_month: 3, budget_amount: 300000, actual_amount: 180000, utilization_pct: 60 },
];

export default function BudgetControl() {
  const [activeTab, setActiveTab] = useState('budgets');
  const [costCenters] = useState(DEMO_COST_CENTERS);
  const [budgets] = useState(DEMO_BUDGETS);
  const [dialogOpen, setDialogOpen] = useState(false);

  const totalBudget = budgets.reduce((s, b) => s + b.budget_amount, 0);
  const totalActual = budgets.reduce((s, b) => s + b.actual_amount, 0);
  const overBudgetCount = budgets.filter(b => b.utilization_pct > 100).length;

  const getUtilizationColor = (pct: number) => {
    if (pct > 100) return 'text-destructive';
    if (pct > 90) return 'text-orange-500';
    if (pct > 70) return 'text-primary';
    return 'text-green-600';
  };

  const getProgressColor = (pct: number) => {
    if (pct > 100) return 'bg-destructive';
    if (pct > 90) return 'bg-orange-500';
    return 'bg-primary';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Target className="w-5 h-5" />
              Controlo Orçamental
            </h1>
            <p className="text-sm text-muted-foreground">Centros de custo, orçamentos e controlo de gastos</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 p-4">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Orçamento Total</p>
            <p className="text-xl font-bold">{totalBudget.toLocaleString('pt-AO')} Kz</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Realizado</p>
            <p className="text-xl font-bold">{totalActual.toLocaleString('pt-AO')} Kz</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Disponível</p>
            <p className={`text-xl font-bold ${totalBudget - totalActual >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {(totalBudget - totalActual).toLocaleString('pt-AO')} Kz
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Acima do Orçamento</p>
            <p className={`text-xl font-bold ${overBudgetCount > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {overBudgetCount} centro{overBudgetCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4">
          <TabsTrigger value="budgets" className="gap-1.5">
            <TrendingUp className="w-4 h-4" /> Orçamento vs Real
          </TabsTrigger>
          <TabsTrigger value="centers" className="gap-1.5">
            <PieChart className="w-4 h-4" /> Centros de Custo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="flex-1 p-4 overflow-auto">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Março 2026</CardTitle>
                <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> Definir Orçamento
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {budgets.map(budget => (
                <div key={budget.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{budget.cost_center_code}</Badge>
                      <span className="font-medium text-sm">{budget.cost_center_name}</span>
                      {budget.utilization_pct > 100 && (
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {budget.actual_amount.toLocaleString('pt-AO')} / {budget.budget_amount.toLocaleString('pt-AO')} Kz
                      </span>
                      <span className={`font-bold min-w-[50px] text-right ${getUtilizationColor(budget.utilization_pct)}`}>
                        {budget.utilization_pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressColor(budget.utilization_pct)}`}
                      style={{ width: `${Math.min(budget.utilization_pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="centers" className="flex-1 p-4 overflow-auto">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Centros de Custo</CardTitle>
                <Button size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Novo Centro
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-20 text-center">Estado</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costCenters.map(cc => (
                    <TableRow key={cc.id}>
                      <TableCell className="font-mono font-medium">{cc.code}</TableCell>
                      <TableCell className="font-medium">{cc.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cc.description}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={cc.is_active ? 'default' : 'secondary'}>
                          {cc.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Budget Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Input placeholder="Seleccionar centro..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input type="number" defaultValue={2026} />
              </div>
              <div className="space-y-2">
                <Label>Mês</Label>
                <Input type="number" defaultValue={3} min={1} max={12} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor do Orçamento (Kz)</Label>
              <Input type="number" placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea placeholder="Observações..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => { setDialogOpen(false); toast.success('Orçamento definido'); }}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
