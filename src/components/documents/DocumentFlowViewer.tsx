import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  FileText, ShoppingCart, Truck, Receipt, CreditCard, CheckCircle, ArrowRight
} from 'lucide-react';

interface FlowNode {
  type: string;
  number: string;
  date: string;
  status: 'completed' | 'active' | 'pending';
  amount?: number;
}

interface DocumentFlowViewerProps {
  nodes: FlowNode[];
  className?: string;
}

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  proforma: { icon: FileText, label: 'Pro Forma', color: 'text-blue-500' },
  purchase_order: { icon: ShoppingCart, label: 'Ordem Compra', color: 'text-orange-500' },
  goods_receipt: { icon: Truck, label: 'Recepção', color: 'text-green-500' },
  invoice: { icon: Receipt, label: 'Factura', color: 'text-primary' },
  credit_note: { icon: FileText, label: 'Nota Crédito', color: 'text-red-500' },
  payment: { icon: CreditCard, label: 'Pagamento', color: 'text-green-600' },
  delivery: { icon: Truck, label: 'Entrega', color: 'text-purple-500' },
  sales_order: { icon: ShoppingCart, label: 'Encomenda', color: 'text-blue-600' },
};

export function DocumentFlowViewer({ nodes, className }: DocumentFlowViewerProps) {
  if (nodes.length === 0) {
    return (
      <div className={cn("text-center py-6 text-muted-foreground text-sm", className)}>
        Nenhum fluxo documental encontrado
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto py-4 px-2", className)}>
      {nodes.map((node, idx) => {
        const config = TYPE_CONFIG[node.type] || { icon: FileText, label: node.type, color: 'text-muted-foreground' };
        const Icon = config.icon;

        return (
          <div key={idx} className="flex items-center gap-1">
            {/* Node */}
            <div className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-lg border min-w-[120px] transition-all",
              node.status === 'active' && "border-primary bg-primary/5 ring-1 ring-primary",
              node.status === 'completed' && "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
              node.status === 'pending' && "border-dashed border-muted-foreground/30 opacity-50"
            )}>
              <div className="flex items-center gap-1.5">
                <Icon className={cn("w-4 h-4", config.color)} />
                <span className="text-xs font-medium">{config.label}</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{node.number}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(node.date).toLocaleDateString('pt-AO')}</span>
              {node.amount !== undefined && (
                <span className="text-xs font-semibold">{node.amount.toLocaleString('pt-AO')} Kz</span>
              )}
              {node.status === 'completed' && (
                <CheckCircle className="w-3 h-3 text-green-500" />
              )}
            </div>

            {/* Arrow */}
            {idx < nodes.length - 1 && (
              <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
