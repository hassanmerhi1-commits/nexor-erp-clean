// Kwanza ERP - Modern Top Navigation
import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Branch, User } from '@/types/erp';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  Building2, User as UserIcon, LogOut, Settings, Menu,
  LayoutDashboard, ShoppingCart, FileText, Package, Users,
  BarChart3, ArrowRightLeft, Calendar, Upload, Truck,
  ClipboardList, Tags, FileCheck, ChevronDown, Search,
  Plus, Pencil, Trash2, Filter, Download, FileSpreadsheet,
  RefreshCw, Save, Printer, X, Info, HelpCircle,
  Database, Calculator, Receipt, Factory, Import, UserCog,
  FolderOpen, BookOpen, Landmark, CreditCard, DollarSign,
  Shield, Wallet, PieChart, TrendingUp, Globe, Keyboard,
  Monitor, Bell,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ServerConnectionIndicator } from '@/components/layout/ServerConnectionIndicator';
import { useCompanyLogo } from '@/hooks/useCompanyLogo';
import defaultLogo from '/favicon.png?url';

interface TopNavProps {
  user: User | null;
  branches: Branch[];
  currentBranch: Branch | null;
  onBranchChange: (branch: Branch) => void;
  onLogout: () => void;
}

export function TopNav({ user, branches, currentBranch, onBranchChange, onLogout }: TopNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logo, companyName } = useCompanyLogo();

  // ========== MENU BAR ==========
  const menuItems = [
    {
      label: 'Ficheiro',
      items: [
        { label: 'Abrir', icon: FolderOpen },
        { label: 'Guardar', icon: Save },
        { label: 'Imprimir', icon: Printer },
        { label: 'separator' },
        { label: 'Cópia de Segurança', icon: Database },
        { label: 'Importar', icon: Download },
        { label: 'separator' },
        { label: 'Sair', icon: LogOut, action: onLogout },
      ],
    },
    {
      label: 'Empresa',
      items: [
        { label: 'Filiais', icon: Building2, path: '/branches' },
        { label: 'Utilizadores', icon: UserCog, path: '/users' },
        { label: 'Configurações', icon: Settings, path: '/settings' },
      ],
    },
    {
      label: 'Invoicing',
      items: [
        { label: 'POS / Ponto de Venda', icon: ShoppingCart, path: '/pos' },
        { label: 'Vendas (Histórico)', icon: Receipt, path: '/vendas' },
        { label: 'Facturas', icon: FileText, path: '/invoices' },
        { label: 'Pro-forma', icon: ClipboardList, path: '/proforma' },
        { label: 'separator' },
        { label: 'Nota de Crédito', icon: CreditCard, path: '/fiscal-documents' },
        { label: 'Nota de Débito', icon: DollarSign, path: '/fiscal-documents' },
      ],
    },
    {
      label: 'Accounting',
      items: [
        { label: 'Recibo', icon: Receipt, path: '/invoices' },
        { label: 'Forma de Receber', icon: Wallet },
        { label: 'Valor Crédito', icon: CreditCard },
        { label: 'separator' },
        { label: 'Pagamento', icon: DollarSign, path: '/expenses' },
        { label: 'Pagamento por Cheque', icon: FileText },
        { label: 'separator' },
        { label: 'Multi Crédito', icon: Plus },
        { label: 'Multi Débito', icon: Plus },
        { label: 'Entrada do Diário', icon: BookOpen, path: '/chart-of-accounts' },
      ],
    },
    {
      label: 'Transações',
      items: [
        { label: 'Transferência de Stock', icon: ArrowRightLeft, path: '/stock-transfer' },
        { label: 'Ajuste de Inventário', icon: RefreshCw, path: '/inventory' },
        { label: 'Devolução de Compra', icon: Truck },
      ],
    },
    {
      label: 'Relatórios',
      items: [
        { label: 'Balancete', icon: PieChart, path: '/reports' },
        { label: 'Demonstração de Resultados', icon: TrendingUp, path: '/reports' },
        { label: 'Balanço', icon: BarChart3, path: '/reports' },
        { label: 'separator' },
        { label: 'Relatórios Diários', icon: Calendar, path: '/daily-reports' },
        { label: 'Extracto de Conta', icon: FileText, path: '/reports' },
        { label: 'separator' },
        { label: 'Movimento de Stock', icon: ArrowRightLeft, path: '/reports' },
        { label: 'Valorização de Stock', icon: DollarSign, path: '/reports' },
        { label: 'Stock por Filial', icon: Building2, path: '/reports' },
      ],
    },
    {
      label: 'Utilities',
      items: [
        { label: 'Modificar Senha Actual', icon: Shield },
        { label: 'Manutenção', icon: Settings },
        { label: 'Calculadora', icon: Calculator },
        { label: 'separator' },
        { label: 'Sincronização', icon: Upload, path: '/data-sync' },
      ],
    },
    {
      label: 'Ajuda',
      items: [
        { label: 'Sobre', icon: Info },
        { label: 'Ajuda', icon: HelpCircle },
      ],
    },
  ];

  // ========== MAIN TABS ==========
  const mainTabs = [
    { label: 'Inicio', path: '/', icon: LayoutDashboard },
    { label: 'Mapa De Contas', path: '/chart-of-accounts', icon: BookOpen },
    { label: 'Stock', path: '/inventory', icon: Package },
    { label: 'Diarios', path: '/journals', icon: Calendar },
    { label: 'Faturas / Vouchers', path: '/invoices', icon: FileText },
    { label: 'Produção', path: '/production', icon: Factory },
    { label: 'Importação', path: '/import', icon: Globe },
    { label: 'HR', path: '/hr', icon: Users },
  ];

  // ========== ACTION TOOLBAR ==========
  const getActionButtons = () => {
    const p = location.pathname;
    if (p === '/' || p === '') return [];

    const base = [
      { label: 'Todos', icon: FolderOpen, variant: 'outline' as const },
      { label: 'Novo', icon: Plus, variant: 'default' as const },
      { label: 'Eliminar', icon: Trash2, variant: 'destructive' as const },
      { label: 'Editar', icon: Pencil, variant: 'outline' as const },
    ];

    if (p.includes('inventory') || p.includes('stock')) {
      return [
        ...base,
        { label: 'Transferência', icon: ArrowRightLeft, variant: 'outline' as const },
        { label: 'Ajustar Saída', icon: RefreshCw, variant: 'outline' as const },
        { label: 'Entrada Inventário', icon: Download, variant: 'outline' as const },
        { label: 'Qtd Mínima', icon: Filter, variant: 'outline' as const },
      ];
    }
    if (p.includes('chart-of-accounts')) {
      return [
        ...base,
        { label: 'Fatura De Venda', icon: FileText, variant: 'outline' as const },
        { label: 'Recibo', icon: Receipt, variant: 'outline' as const },
        { label: 'Pagamento', icon: DollarSign, variant: 'outline' as const },
        { label: 'Fatura de Compra', icon: Truck, variant: 'outline' as const },
        { label: 'Entrada do Diário', icon: BookOpen, variant: 'outline' as const },
      ];
    }
    if (p.includes('invoices') || p.includes('fiscal') || p.includes('proforma')) {
      return [
        ...base,
        { label: 'Imprimir', icon: Printer, variant: 'outline' as const },
        { label: 'AGT Send', icon: Upload, variant: 'outline' as const },
      ];
    }
    if (p.includes('pos')) {
      return [
        { label: 'Nova Venda', icon: Plus, variant: 'default' as const },
        { label: 'Guardar', icon: Save, variant: 'outline' as const },
        { label: 'Anular', icon: X, variant: 'destructive' as const },
      ];
    }
    return base;
  };

  const actionButtons = getActionButtons();

  return (
    <header className="sticky top-0 z-50">
      {/* ====== ROW 1: Menu Bar ====== */}
      <div className="h-10 px-3 bg-sidebar text-sidebar-foreground hidden lg:flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Logo */}
          <div className="flex items-center gap-2 pr-4 mr-2 border-r border-sidebar-border">
            <div className="w-6 h-6 rounded-lg overflow-hidden bg-sidebar-accent flex items-center justify-center">
              <img src={logo || defaultLogo} alt={companyName} className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-sm tracking-tight text-sidebar-primary">
              {companyName}
            </span>
          </div>

          {menuItems.map((menu) => (
            <DropdownMenu key={menu.label}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md">
                  {menu.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[220px] animate-scale-in">
                {menu.items.map((item, idx) =>
                  item.label === 'separator' ? (
                    <DropdownMenuSeparator key={idx} />
                  ) : (
                    <DropdownMenuItem
                      key={item.label}
                      onClick={() => {
                        if ((item as any).action) (item as any).action();
                        else if ((item as any).path) navigate((item as any).path);
                      }}
                      className="text-xs gap-2"
                    >
                      {item.icon && <item.icon className="w-3.5 h-3.5 text-muted-foreground" />}
                      {item.label}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ServerConnectionIndicator />
          <LanguageSwitcher />

          <Select
            value={currentBranch?.id}
            onValueChange={(id) => {
              const branch = branches.find(b => b.id === id);
              if (branch) onBranchChange(branch);
            }}
          >
            <SelectTrigger className="h-7 w-[140px] text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
              <Building2 className="w-3.5 h-3.5 mr-1.5 text-sidebar-primary" />
              <SelectValue placeholder="Filial" />
            </SelectTrigger>
            <SelectContent>
              {branches.map(branch => (
                <SelectItem key={branch.id} value={branch.id} className="text-xs">
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent">
                <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="hidden xl:inline">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 animate-scale-in">
              <div className="px-3 py-2 border-b">
                <p className="font-semibold text-sm">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuItem className="text-xs gap-2 mt-1">
                <Shield className="w-3.5 h-3.5" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs gap-2" onClick={() => navigate('/settings')}>
                <Settings className="w-3.5 h-3.5" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-destructive text-xs gap-2">
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ====== ROW 2: Main Tabs ====== */}
      <div className="h-10 px-2 bg-card hidden lg:flex items-end gap-0.5 border-b overflow-x-auto">
        {mainTabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === '/'}
            className={({ isActive }) => cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-t-lg transition-all relative",
              isActive
                ? "bg-background text-primary border-t-2 border-x border-t-primary border-x-border -mb-px shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* ====== ROW 3: Action Toolbar ====== */}
      {actionButtons.length > 0 && (
        <div className="h-10 px-3 bg-background hidden lg:flex items-center gap-1.5 border-b overflow-x-auto">
          {actionButtons.map((btn, idx) => (
            <Button key={idx} variant={btn.variant} size="sm" className="h-7 text-xs gap-1.5 px-3 rounded-lg">
              <btn.icon className="w-3.5 h-3.5" />
              {btn.label}
            </Button>
          ))}
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-3 rounded-lg">
            <Filter className="w-3.5 h-3.5" />
            Filtro
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-3 rounded-lg">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </Button>
        </div>
      )}

      {/* ====== Mobile Header ====== */}
      <div className="h-14 px-4 flex lg:hidden items-center justify-between bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-sidebar-accent flex items-center justify-center">
            <img src={logo || defaultLogo} alt={companyName} className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-sm tracking-tight">{companyName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={currentBranch?.id}
            onValueChange={(id) => {
              const branch = branches.find(b => b.id === id);
              if (branch) onBranchChange(branch);
            }}
          >
            <SelectTrigger className="h-8 w-[110px] text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
              <Building2 className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches.map(branch => (
                <SelectItem key={branch.id} value={branch.id} className="text-xs">
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="lg:hidden border-t bg-card p-3 max-h-[70vh] overflow-y-auto animate-fade-in">
          <div className="grid grid-cols-4 gap-2">
            {mainTabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl text-[10px] font-medium transition-all",
                  isActive ? "gradient-primary text-primary-foreground shadow-glow" : "bg-muted hover:bg-accent"
                )}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </NavLink>
            ))}
          </div>
          <div className="pt-3 mt-3 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">{user?.name}</span>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-destructive text-xs h-7 gap-1">
              <LogOut className="w-3.5 h-3.5" /> Sair
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
