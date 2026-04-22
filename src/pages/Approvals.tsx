import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  GitBranch, CheckCircle, XCircle, Clock, User, MessageSquare, ArrowRight, Settings
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  pending: { label: 'Pendente', variant: 'outline', icon: Clock },
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Rejeitado', variant: 'destructive', icon: XCircle },
  cancelled: { label: 'Cancelado', variant: 'secondary', icon: XCircle },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  purchase_order: 'Ordem de Compra',
  expense: 'Despesa',
  credit_note: 'Nota de Crédito',
  payment: 'Pagamento',
};

// Demo data
const DEMO_REQUESTS = [
  { id: '1', document_type: 'purchase_order', document_number: 'OC-20260331-0005', amount: 850000, status: 'pending', current_step: 1, total_steps: 2, requested_by_name: 'Operador1', workflow_name: 'Aprovação Ordem de Compra Alto Valor', created_at: new Date().toISOString(), actions: [] },
  { id: '2', document_type: 'expense', document_number: 'DESP-20260330-0012', amount: 75000, status: 'pending', current_step: 1, total_steps: 1, requested_by_name: 'Admin', workflow_name: 'Aprovação Despesa', created_at: new Date(Date.now() - 86400000).toISOString(), actions: [] },
  { id: '3', document_type: 'purchase_order', document_number: 'OC-20260329-0003', amount: 320000, status: 'approved', current_step: 1, total_steps: 1, requested_by_name: 'Operador2', workflow_name: 'Aprovação Ordem de Compra', created_at: new Date(Date.now() - 172800000).toISOString(), actions: [{ action: 'approve', user_name: 'Director', comments: 'Aprovado. Fornecedor preferencial.', created_at: new Date(Date.now() - 86400000).toISOString() }] },
  { id: '4', document_type: 'credit_note', document_number: 'NC-20260328-0001', amount: 45000, status: 'rejected', current_step: 1, total_steps: 1, requested_by_name: 'Admin', workflow_name: 'Aprovação Nota de Crédito', created_at: new Date(Date.now() - 259200000).toISOString(), actions: [{ action: 'reject', user_name: 'Director', comments: 'Justificação insuficiente. Resubmeter com documentação.', created_at: new Date(Date.now() - 172800000).toISOString() }] },
];

const DEMO_WORKFLOWS = [
  { id: '1', name: 'Aprovação Ordem de Compra', document_type: 'purchase_order', min_amount: 0, max_amount: 500000, steps: [{ step: 1, role: 'manager', label: 'Gestor de Compras' }] },
  { id: '2', name: 'Aprovação OC Alto Valor', document_type: 'purchase_order', min_amount: 500000, max_amount: null, steps: [{ step: 1, role: 'manager', label: 'Gestor de Compras' }, { step: 2, role: 'admin', label: 'Director Financeiro' }] },
  { id: '3', name: 'Aprovação Despesa', document_type: 'expense', min_amount: 50000, max_amount: null, steps: [{ step: 1, role: 'manager', label: 'Gestor' }] },
  { id: '4', name: 'Aprovação Nota de Crédito', document_type: 'credit_note', min_amount: 0, max_amount: null, steps: [{ step: 1, role: 'admin', label: 'Administrador' }] },
];

export default function Approvals() {
  const [activeTab, setActiveTab] = useState('requests');
  const [requests, setRequests] = useState(DEMO_REQUESTS);
  const [workflows] = useState(DEMO_WORKFLOWS);
  const [actionDialog, setActionDialog] = useState<{ requestId: string; action: 'approve' | 'reject' } | null>(null);
  const [comments, setComments] = useState('');

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const handleAction = () => {
    if (!actionDialog) return;
    setRequests(prev => prev.map(r =>
      r.id === actionDialog.requestId
        ? { ...r, status: actionDialog.action === 'approve' ? 'approved' : 'rejected',
            actions: [...r.actions, { action: actionDialog.action, user_name: 'Admin', comments, created_at: new Date().toISOString() }] }
        : r
    ));
    toast.success(actionDialog.action === 'approve' ? 'Documento aprovado' : 'Documento rejeitado');
    setActionDialog(null);
    setComments('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Aprovações
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingCount}</Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">Fluxos de aprovação para documentos e transacções</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2">
          <TabsTrigger value="requests" className="gap-1.5">
            <Clock className="w-4 h-4" /> Pedidos
            {pendingCount > 0 && <Badge variant="destructive" className="ml-1 h-5 text-[10px]">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-1.5">
            <Settings className="w-4 h-4" /> Fluxos
          </TabsTrigger>
        </TabsList>

        {/* Requests Tab */}
        <TabsContent value="requests" className="flex-1 p-4 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Fluxo</TableHead>
                <TableHead>Passo</TableHead>
                <TableHead>Solicitado por</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map(req => {
                const statusCfg = STATUS_CONFIG[req.status];
                const StatusIcon = statusCfg.icon;
                return (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono font-medium">{req.document_number}</TableCell>
                    <TableCell>{DOC_TYPE_LABELS[req.document_type] || req.document_type}</TableCell>
                    <TableCell className="text-right font-mono">{req.amount.toLocaleString('pt-AO')} Kz</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{req.workflow_name}</TableCell>
                    <TableCell>
                      <span className="text-xs">{req.current_step}/{req.total_steps}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">{req.requested_by_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString('pt-AO')}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusCfg.variant} className="gap-1">
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {req.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" className="h-7 text-xs gap-1"
                            onClick={() => setActionDialog({ requestId: req.id, action: 'approve' })}>
                            <CheckCircle className="w-3 h-3" /> Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs gap-1"
                            onClick={() => setActionDialog({ requestId: req.id, action: 'reject' })}>
                            <XCircle className="w-3 h-3" /> Rejeitar
                          </Button>
                        </div>
                      )}
                      {req.actions.length > 0 && req.status !== 'pending' && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {req.actions[req.actions.length - 1].comments?.slice(0, 30)}...
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="flex-1 p-4 overflow-auto">
          <div className="grid gap-3">
            {workflows.map(wf => {
              const steps = typeof wf.steps === 'string' ? JSON.parse(wf.steps) : wf.steps;
              return (
                <Card key={wf.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{wf.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{DOC_TYPE_LABELS[wf.document_type]}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {wf.min_amount > 0 ? `≥ ${wf.min_amount.toLocaleString('pt-AO')} Kz` : 'Qualquer valor'}
                            {wf.max_amount ? ` até ${wf.max_amount.toLocaleString('pt-AO')} Kz` : ''}
                          </span>
                        </div>
                      </div>
                      <Badge>{steps.length} passo{steps.length > 1 ? 's' : ''}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {steps.map((step: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-md text-xs">
                            <span className="font-medium">{step.step}.</span>
                            <span>{step.label}</span>
                            <Badge variant="secondary" className="text-[10px] ml-1">{step.role}</Badge>
                          </div>
                          {i < steps.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Approve/Reject Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === 'approve' ? 'Aprovar Documento' : 'Rejeitar Documento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comentários {actionDialog?.action === 'reject' ? '(obrigatório)' : '(opcional)'}</Label>
              <Textarea value={comments} onChange={e => setComments(e.target.value)}
                placeholder={actionDialog?.action === 'approve' ? 'Observações...' : 'Motivo da rejeição...'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancelar</Button>
            <Button
              variant={actionDialog?.action === 'approve' ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={actionDialog?.action === 'reject' && !comments.trim()}
            >
              {actionDialog?.action === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
