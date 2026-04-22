// Kwanza ERP Faturas/Vouchers workspace
// Multi-tab document browser with linked conversion flow

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { useAuth } from '@/hooks/useERP';
import { useBranchContext } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Plus, Search, Eye, Printer, RefreshCw, FileText, Receipt,
  Banknote, CreditCard, ArrowRight, Download, XCircle, CheckCircle,
  Clock, ChevronDown, ArrowRightLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { printDocument, downloadDocumentHTML } from '@/lib/documentPDF';
import { DocumentType, ERPDocument, DOCUMENT_TYPE_CONFIG, DocumentStatus } from '@/types/documents';
import { getDocuments, convertDocument } from '@/lib/documentStorage';
import { DocumentFormDialog } from '@/components/documents/DocumentFormDialog';
import { DocumentFlowViewer } from '@/components/documents/DocumentFlowViewer';

// Build flow nodes from a document and its linked chain
function buildFlowNodes(doc: ERPDocument): { type: string; number: string; date: string; status: 'completed' | 'active' | 'pending'; amount?: number }[] {
  const nodes: { type: string; number: string; date: string; status: 'completed' | 'active' | 'pending'; amount?: number }[] = [];

  // Parent document (origin)
  if (doc.parentDocumentNumber && doc.parentDocumentType) {
    const typeMap: Record<string, string> = {
      proforma: 'proforma', fatura_venda: 'invoice', fatura_compra: 'invoice',
      recibo: 'payment', pagamento: 'payment', nota_credito: 'credit_note',
      nota_debito: 'invoice', guia_remessa: 'delivery',
    };
    nodes.push({
      type: typeMap[doc.parentDocumentType] || doc.parentDocumentType,
      number: doc.parentDocumentNumber,
      date: doc.issueDate,
      status: 'completed',
    });
  }

  // Current document
  const currentTypeMap: Record<string, string> = {
    proforma: 'proforma', fatura_venda: 'invoice', fatura_compra: 'invoice',
    recibo: 'payment', pagamento: 'payment', nota_credito: 'credit_note',
    nota_debito: 'invoice', guia_remessa: 'delivery',
  };
  nodes.push({
    type: currentTypeMap[doc.documentType] || doc.documentType,
    number: doc.documentNumber,
    date: doc.issueDate,
    status: 'active',
    amount: doc.total,
  });

  // Child documents
  if (doc.childDocuments) {
    for (const child of doc.childDocuments) {
      nodes.push({
        type: currentTypeMap[child.type] || child.type,
        number: child.number,
        date: doc.issueDate,
        status: 'completed',
      });
    }
  }

  return nodes;
}

const DOC_TABS: { key: DocumentType | 'all'; label: string; icon: any }[] = [
  { key: 'all', label: 'Todos', icon: FileText },
  { key: 'proforma', label: 'Proforma', icon: FileText },
  { key: 'fatura_venda', label: 'Fat. Venda', icon: FileText },
  { key: 'fatura_compra', label: 'Fat. Compra', icon: FileText },
  { key: 'recibo', label: 'Recibo', icon: Receipt },
  { key: 'pagamento', label: 'Pagamento', icon: Banknote },
  { key: 'nota_credito', label: 'N. Crédito', icon: CreditCard },
  { key: 'nota_debito', label: 'N. Débito', icon: CreditCard },
  { key: 'guia_remessa', label: 'G. Remessa', icon: FileText },
];

const STATUS_BADGES: Record<DocumentStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  pending: { label: 'Pendente', variant: 'outline' },
  confirmed: { label: 'Confirmado', variant: 'default' },
  paid: { label: 'Pago', variant: 'default' },
  partial: { label: 'Parcial', variant: 'outline' },
  cancelled: { label: 'Anulado', variant: 'destructive' },
  converted: { label: 'Convertido', variant: 'secondary' },
};

export default function Invoices() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentBranch } = useBranchContext();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<DocumentType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [formDocType, setFormDocType] = useState<DocumentType>('fatura_venda');
  const [editDoc, setEditDoc] = useState<ERPDocument | null>(null);
  const [prefillDoc, setPrefillDoc] = useState<ERPDocument | null>(null);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Load documents
  const [documents, setDocuments] = useState<ERPDocument[]>([]);

  useEffect(() => {
    const type = activeTab === 'all' ? undefined : activeTab;
    getDocuments(type, currentBranch?.id).then(setDocuments);
  }, [activeTab, currentBranch?.id, refreshKey]);

  const filteredDocs = useMemo(() => {
    if (!searchTerm) return documents;
    const q = searchTerm.toLowerCase();
    return documents.filter(d =>
      d.documentNumber.toLowerCase().includes(q) ||
      d.entityName.toLowerCase().includes(q) ||
      (d.entityNif && d.entityNif.includes(q))
    );
  }, [documents, searchTerm]);

  const selectedDoc = filteredDocs.find(d => d.id === selectedDocId);

  // Totals
  const totals = useMemo(() => ({
    count: filteredDocs.length,
    total: filteredDocs.reduce((s, d) => s + d.total, 0),
    paid: filteredDocs.reduce((s, d) => s + d.amountPaid, 0),
    due: filteredDocs.reduce((s, d) => s + d.amountDue, 0),
  }), [filteredDocs]);

  const openNewDocument = (type: DocumentType) => {
    setFormDocType(type);
    setEditDoc(null);
    setPrefillDoc(null);
    setFormOpen(true);
  };

  const openEditDocument = (doc: ERPDocument) => {
    setFormDocType(doc.documentType);
    setEditDoc(doc);
    setPrefillDoc(null);
    setFormOpen(true);
  };

  const handleConvert = async (doc: ERPDocument, targetType: DocumentType) => {
    const result = await convertDocument(
      doc.id,
      targetType,
      currentBranch?.code || 'SEDE',
      user?.id || '',
      user?.name || ''
    );
    if (result) {
      toast.success(`${DOCUMENT_TYPE_CONFIG[targetType].shortLabel} ${result.documentNumber} criado a partir de ${doc.documentNumber}`);
      refresh();
    } else {
      toast.error('Conversão não permitida');
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 border-b flex-wrap">
        {/* New document dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Plus className="w-3 h-3" /> Novo Documento <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {Object.entries(DOCUMENT_TYPE_CONFIG).map(([key, cfg]) => (
              <DropdownMenuItem key={key} onClick={() => {
                if (key === 'fatura_compra') {
                  navigate('/purchase-invoices');
                } else {
                  openNewDocument(key as DocumentType);
                }
              }}>
                <span className={cn("mr-2", cfg.color)}>■</span>
                {cfg.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={!selectedDoc}
          onClick={() => selectedDoc && openEditDocument(selectedDoc)}>
          <Eye className="w-3 h-3" /> Ver / Editar
        </Button>

        {/* Convert button */}
        {selectedDoc && DOCUMENT_TYPE_CONFIG[selectedDoc.documentType].canConvertTo.length > 0 && selectedDoc.status !== 'converted' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-blue-600 border-blue-200">
                <ArrowRightLeft className="w-3 h-3" /> Converter <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {DOCUMENT_TYPE_CONFIG[selectedDoc.documentType].canConvertTo.map(targetType => (
                <DropdownMenuItem key={targetType} onClick={() => handleConvert(selectedDoc, targetType)}>
                  <ArrowRight className="w-3 h-3 mr-2" />
                  {DOCUMENT_TYPE_CONFIG[targetType].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={!selectedDoc}
          onClick={() => selectedDoc && printDocument(selectedDoc)}>
          <Printer className="w-3 h-3" /> Imprimir
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={!selectedDoc}
          onClick={() => selectedDoc && downloadDocumentHTML(selectedDoc)}>
          <Download className="w-3 h-3" /> PDF
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={refresh}>
          <RefreshCw className="w-3 h-3" />
        </Button>

        <div className="flex-1" />

        {/* Document flow legend */}
        <div className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground mr-2">
          <span className="text-blue-600 font-medium">Proforma</span>
          <ArrowRight className="w-3 h-3" />
          <span className="text-green-600 font-medium">Fatura</span>
          <ArrowRight className="w-3 h-3" />
          <span className="text-emerald-600 font-medium">Recibo</span>
          <ArrowRight className="w-3 h-3" />
          <span className="text-red-600 font-medium">Pagamento</span>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="h-7 text-xs pl-7 w-40" />
        </div>
      </div>

      {/* Document type tabs */}
      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as any); setSelectedDocId(null); }} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-auto p-0 overflow-x-auto">
          {DOC_TABS.map(tab => {
            const config = tab.key !== 'all' ? DOCUMENT_TYPE_CONFIG[tab.key] : null;
            return (
              <TabsTrigger key={tab.key} value={tab.key}
                className={cn(
                  "text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-3 py-1.5",
                  config && `data-[state=active]:${config.color}`
                )}>
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Single content area for all tabs (same grid) */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 border-b sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold w-12">Tipo</th>
                <th className="px-3 py-2 text-left font-semibold w-36">Nº Documento</th>
                <th className="px-3 py-2 text-left font-semibold w-24">Data</th>
                <th className="px-3 py-2 text-left font-semibold">{activeTab === 'fatura_compra' || activeTab === 'pagamento' ? 'Fornecedor' : 'Cliente'}</th>
                <th className="px-3 py-2 text-left font-semibold w-24">NIF</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Total</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Pago</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Em Dívida</th>
                <th className="px-3 py-2 text-center font-semibold w-20">Estado</th>
                <th className="px-3 py-2 text-left font-semibold w-16">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredDocs.map(doc => {
                const config = DOCUMENT_TYPE_CONFIG[doc.documentType];
                const statusBadge = STATUS_BADGES[doc.status];
                return (
                  <tr key={doc.id}
                    className={cn("cursor-pointer hover:bg-accent/50 transition-colors",
                      selectedDocId === doc.id && "bg-primary/15")}
                    onClick={() => setSelectedDocId(doc.id)}
                    onDoubleClick={() => openEditDocument(doc)}>
                    <td className={cn("px-3 py-1.5 font-medium", config.color)}>{config.prefix}</td>
                    <td className="px-3 py-1.5 font-mono">{doc.documentNumber}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{new Date(doc.issueDate).toLocaleDateString('pt-AO')}</td>
                    <td className="px-3 py-1.5">{doc.entityName}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{doc.entityNif || '-'}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium">{doc.total.toLocaleString('pt-AO')}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-green-600">{doc.amountPaid.toLocaleString('pt-AO')}</td>
                    <td className={cn("px-3 py-1.5 text-right font-mono", doc.amountDue > 0 && "text-destructive font-medium")}>
                      {doc.amountDue.toLocaleString('pt-AO')}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <Badge variant={statusBadge.variant} className="text-[10px] px-1.5 py-0">{statusBadge.label}</Badge>
                    </td>
                    <td className="px-3 py-1.5">
                      {doc.parentDocumentNumber ? (
                        <span className="text-[10px] text-blue-500 font-mono">{doc.parentDocumentNumber.split('-').slice(0, 2).join('-')}</span>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/80 border-t-2 border-primary/30">
              <tr className="font-bold text-xs">
                <td className="px-3 py-2" colSpan={5}>TOTAL ({totals.count} documentos)</td>
                <td className="px-3 py-2 text-right font-mono">{totals.total.toLocaleString('pt-AO')} Kz</td>
                <td className="px-3 py-2 text-right font-mono text-green-600">{totals.paid.toLocaleString('pt-AO')} Kz</td>
                <td className="px-3 py-2 text-right font-mono text-destructive">{totals.due.toLocaleString('pt-AO')} Kz</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
          {filteredDocs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum documento encontrado</p>
              <p className="text-xs mt-1">Clique em "Novo Documento" para criar</p>
            </div>
          )}
        </div>
      </Tabs>

      {/* Selected document info bar with Document Flow */}
      {selectedDoc && (
        <div className="border-t">
          <div className="h-7 bg-primary/10 flex items-center px-3 text-[10px] gap-4">
            <span className={cn("font-bold", DOCUMENT_TYPE_CONFIG[selectedDoc.documentType].color)}>
              {selectedDoc.documentNumber}
            </span>
            <span>{selectedDoc.entityName}</span>
            <span>Total: {selectedDoc.total.toLocaleString('pt-AO')} Kz</span>
            {selectedDoc.parentDocumentNumber && (
              <span className="text-blue-500">Origem: {selectedDoc.parentDocumentNumber}</span>
            )}
            {selectedDoc.childDocuments && selectedDoc.childDocuments.length > 0 && (
              <span className="text-green-600">
                Gerou: {selectedDoc.childDocuments.map(c => c.number).join(', ')}
              </span>
            )}
          </div>
          {/* Document Flow Chain */}
          <DocumentFlowViewer nodes={buildFlowNodes(selectedDoc)} className="border-t bg-muted/20 px-3 py-1" />
        </div>
      )}

      {/* Document Form Dialog */}
      <DocumentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        documentType={formDocType}
        editDocument={editDoc}
        prefillFrom={prefillDoc}
        onSaved={refresh}
      />
    </div>
  );
}
