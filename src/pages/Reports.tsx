import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, Users, Truck, TrendingUp, Calendar, 
  FileText, Download, Printer, DollarSign, Clock,
  Package, PieChart, ArrowUpRight, Scale, ArrowRightLeft, History
} from 'lucide-react';
import ClientStatementReport from '@/components/reports/ClientStatementReport';
import SupplierStatementReport from '@/components/reports/SupplierStatementReport';
import SalesAnalysisReport from '@/components/reports/SalesAnalysisReport';
import AccountsReceivableReport from '@/components/reports/AccountsReceivableReport';
import AccountsPayableReport from '@/components/reports/AccountsPayableReport';
import ProfitabilityReport from '@/components/reports/ProfitabilityReport';
import TrialBalanceReport from '@/components/reports/TrialBalanceReport';
import IncomeStatementReport from '@/components/reports/IncomeStatementReport';
import BalanceSheetReport from '@/components/reports/BalanceSheetReport';
import StockValuationReport from '@/components/reports/StockValuationReport';
import StockMovementReport from '@/components/reports/StockMovementReport';
import { TransactionHistoryReport } from '@/components/reports/TransactionHistoryReport';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('overview');

  const reportCategories = [
    {
      id: 'sales',
      title: 'Vendas',
      description: 'Análise de vendas por período, produto e filial',
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      id: 'clients',
      title: 'Clientes',
      description: 'Extracto de conta e contas a receber',
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      id: 'suppliers',
      title: 'Fornecedores',
      description: 'Conta corrente e contas a pagar',
      icon: Truck,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      id: 'inventory',
      title: 'Inventário',
      description: 'Movimentos de stock e valorização',
      icon: Package,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      id: 'financial',
      title: 'Financeiro',
      description: 'Rentabilidade e margens de lucro',
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Centro de Relatórios
          </h1>
          <p className="text-muted-foreground">
            Relatórios financeiros, comerciais e operacionais
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col px-6">
        <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-auto p-0 flex-wrap">
          <TabsTrigger value="overview" className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="sales" className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            <TrendingUp className="w-4 h-4 mr-2" />
            Vendas
          </TabsTrigger>
          <TabsTrigger value="trial-balance" className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            <Scale className="w-4 h-4 mr-2" />
            Balancete
          </TabsTrigger>
          <TabsTrigger value="income-statement" className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            <DollarSign className="w-4 h-4 mr-2" />
            Lucros/Perdas
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            <FileText className="w-4 h-4 mr-2" />
            Balanço
          </TabsTrigger>
          <TabsTrigger value="stock-valuation" className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            <Package className="w-4 h-4 mr-2" />
            Stock
          </TabsTrigger>
          <TabsTrigger value="stock-movements" className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Movimentos
          </TabsTrigger>
          <TabsTrigger value="client-statement" className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            <Users className="w-4 h-4 mr-2" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="supplier-statement" className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            <Truck className="w-4 h-4 mr-2" />
            Fornecedores
          </TabsTrigger>
          <TabsTrigger value="profitability" className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            <PieChart className="w-4 h-4 mr-2" />
            Rentabilidade
          </TabsTrigger>
          <TabsTrigger value="transaction-history" className="text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            <History className="w-4 h-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto py-4">
          <TabsContent value="overview" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportCategories.map((category) => (
                <Card 
                  key={category.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setActiveTab(category.id === 'clients' ? 'client-statement' : 
                                              category.id === 'suppliers' ? 'supplier-statement' :
                                              category.id === 'financial' ? 'profitability' : category.id)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${category.bgColor}`}>
                        <category.icon className={`w-6 h-6 ${category.color}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{category.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {category.description}
                        </p>
                        <Button variant="link" className="p-0 h-auto mt-2 text-primary">
                          Ver Relatórios <ArrowUpRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo Rápido</CardTitle>
                <CardDescription>Indicadores principais do período</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Vendas do Mês</p>
                    <p className="text-2xl font-bold">---</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">A Receber</p>
                    <p className="text-2xl font-bold text-blue-500">---</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">A Pagar</p>
                    <p className="text-2xl font-bold text-orange-500">---</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Margem Média</p>
                    <p className="text-2xl font-bold text-green-500">---</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales" className="mt-0">
            <SalesAnalysisReport />
          </TabsContent>

          <TabsContent value="trial-balance" className="mt-0">
            <TrialBalanceReport />
          </TabsContent>

          <TabsContent value="income-statement" className="mt-0">
            <IncomeStatementReport />
          </TabsContent>

          <TabsContent value="balance-sheet" className="mt-0">
            <BalanceSheetReport />
          </TabsContent>

          <TabsContent value="stock-valuation" className="mt-0">
            <StockValuationReport />
          </TabsContent>

          <TabsContent value="stock-movements" className="mt-0">
            <StockMovementReport />
          </TabsContent>

          <TabsContent value="client-statement" className="mt-0">
            <ClientStatementReport />
          </TabsContent>

          <TabsContent value="supplier-statement" className="mt-0">
            <SupplierStatementReport />
          </TabsContent>

          <TabsContent value="profitability" className="mt-0">
            <ProfitabilityReport />
          </TabsContent>

          <TabsContent value="transaction-history" className="mt-0">
            <TransactionHistoryReport />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
