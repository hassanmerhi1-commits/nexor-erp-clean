import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings2, Save, Trash2, Download, Upload, ArrowRight, Check, AlertCircle, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';

// Types for column mapping
export interface ColumnMapping {
  systemField: string;
  excelColumn: string;
  required: boolean;
}

export interface MappingTemplate {
  id: string;
  name: string;
  type: 'products' | 'clients' | 'suppliers';
  mappings: ColumnMapping[];
  createdAt: string;
}

// System field definitions
export const PRODUCT_FIELDS = [
  { key: 'codigo', label: 'Código/SKU', required: true },
  { key: 'descricao', label: 'Descrição/Nome', required: true },
  { key: 'preco', label: 'Preço de Venda', required: false },
  { key: 'custo', label: 'Preço de Custo', required: false },
  { key: 'quantidade', label: 'Quantidade/Stock', required: false },
  { key: 'unidade', label: 'Unidade', required: false },
  { key: 'categoria', label: 'Categoria', required: false },
  { key: 'iva', label: 'IVA %', required: false },
  { key: 'codigoBarras', label: 'Código de Barras', required: false },
  { key: 'fornecedor', label: 'Fornecedor', required: false },
  { key: 'qtdMinima', label: 'Quantidade Mínima', required: false },
  { key: 'localizacao', label: 'Localização', required: false },
];

export const CLIENT_FIELDS = [
  { key: 'nome', label: 'Nome', required: true },
  { key: 'nif', label: 'NIF', required: true },
  { key: 'telefone', label: 'Telefone', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'morada', label: 'Morada/Endereço', required: false },
  { key: 'cidade', label: 'Cidade', required: false },
  { key: 'pais', label: 'País', required: false },
  { key: 'limiteCredito', label: 'Limite de Crédito', required: false },
];

export const SUPPLIER_FIELDS = [
  { key: 'nome', label: 'Nome', required: true },
  { key: 'nif', label: 'NIF', required: true },
  { key: 'pessoaContacto', label: 'Pessoa de Contacto', required: false },
  { key: 'telefone', label: 'Telefone', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'morada', label: 'Morada/Endereço', required: false },
  { key: 'cidade', label: 'Cidade', required: false },
  { key: 'pais', label: 'País', required: false },
  { key: 'prazoPagamento', label: 'Prazo de Pagamento', required: false },
  { key: 'notas', label: 'Notas', required: false },
];

// Storage key for templates
const TEMPLATES_STORAGE_KEY = 'excel_mapping_templates';

// Load saved templates
export function loadMappingTemplates(): MappingTemplate[] {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save templates
export function saveMappingTemplates(templates: MappingTemplate[]) {
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

interface ColumnMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'products' | 'clients' | 'suppliers';
  onApplyMapping: (mappings: ColumnMapping[]) => void;
  excelColumns?: string[];
}

export function ColumnMappingDialog({
  open,
  onOpenChange,
  type,
  onApplyMapping,
  excelColumns = [],
}: ColumnMappingDialogProps) {
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [detectedColumns, setDetectedColumns] = useState<string[]>(excelColumns);

  const fields = type === 'products' ? PRODUCT_FIELDS : type === 'clients' ? CLIENT_FIELDS : SUPPLIER_FIELDS;
  const typeLabel = type === 'products' ? 'Produtos' : type === 'clients' ? 'Clientes' : 'Fornecedores';

  // Initialize mappings from fields
  useEffect(() => {
    const initialMappings = fields.map(f => ({
      systemField: f.key,
      excelColumn: '',
      required: f.required,
    }));
    setMappings(initialMappings);
    setTemplates(loadMappingTemplates().filter(t => t.type === type));
  }, [type]);

  // Update when excel columns change
  useEffect(() => {
    if (excelColumns.length > 0) {
      setDetectedColumns(excelColumns);
      // Try to auto-match columns
      autoMatchColumns(excelColumns);
    }
  }, [excelColumns]);

  // Auto-match columns based on common patterns
  const autoMatchColumns = (cols: string[]) => {
    const newMappings = mappings.map(m => {
      const field = fields.find(f => f.key === m.systemField);
      if (!field) return m;

      // Try to find a matching column
      const matchPatterns: Record<string, string[]> = {
        codigo: ['código', 'codigo', 'sku', 'ref', 'referencia', 'referência', 'code', 'id'],
        descricao: ['descrição', 'descricao', 'nome', 'produto', 'name', 'description', 'item'],
        preco: ['preço', 'preco', 'preço venda', 'preco venda', 'price', 'pvp', 'valor'],
        custo: ['custo', 'preço custo', 'preco custo', 'cost', 'valor custo'],
        quantidade: ['quantidade', 'qty', 'qtd', 'stock', 'estoque'],
        unidade: ['unidade', 'un', 'unit', 'uom'],
        categoria: ['categoria', 'category', 'família', 'familia', 'family', 'grupo', 'group'],
        iva: ['iva', 'imposto', 'tax', '%'],
        codigoBarras: ['código barras', 'codigo barras', 'barcode', 'ean', 'gtin'],
        fornecedor: ['fornecedor', 'supplier', 'vendor'],
        qtdMinima: ['qtd mínima', 'qtd minima', 'min qty', 'minimo', 'mínimo'],
        localizacao: ['localização', 'localizacao', 'location', 'armazém', 'armazem'],
        nome: ['nome', 'name', 'razão social', 'razao social', 'empresa'],
        nif: ['nif', 'contribuinte', 'vat', 'tax id', 'cnpj', 'cpf'],
        telefone: ['telefone', 'tel', 'phone', 'celular', 'mobile', 'contacto'],
        email: ['email', 'e-mail', 'correio'],
        morada: ['morada', 'endereço', 'endereco', 'address', 'rua'],
        cidade: ['cidade', 'city', 'localidade'],
        pais: ['país', 'pais', 'country'],
        limiteCredito: ['limite crédito', 'limite credito', 'credit limit', 'crédito'],
        pessoaContacto: ['pessoa contacto', 'contacto', 'contact', 'contact person'],
        prazoPagamento: ['prazo pagamento', 'payment terms', 'prazo'],
        notas: ['notas', 'notes', 'observações', 'obs'],
      };

      const patterns = matchPatterns[m.systemField] || [];
      const matchedCol = cols.find(col => 
        patterns.some(p => col.toLowerCase().includes(p.toLowerCase()))
      );

      return {
        ...m,
        excelColumn: matchedCol || m.excelColumn,
      };
    });

    setMappings(newMappings);
  };

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMappings(template.mappings);
      setSelectedTemplate(templateId);
    }
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;

    const newTemplate: MappingTemplate = {
      id: `template_${Date.now()}`,
      name: templateName.trim(),
      type,
      mappings,
      createdAt: new Date().toISOString(),
    };

    const allTemplates = loadMappingTemplates();
    allTemplates.push(newTemplate);
    saveMappingTemplates(allTemplates);
    
    setTemplates([...templates, newTemplate]);
    setTemplateName('');
    setShowSaveForm(false);
    setSelectedTemplate(newTemplate.id);
  };

  const handleDeleteTemplate = (templateId: string) => {
    const allTemplates = loadMappingTemplates().filter(t => t.id !== templateId);
    saveMappingTemplates(allTemplates);
    setTemplates(templates.filter(t => t.id !== templateId));
    if (selectedTemplate === templateId) {
      setSelectedTemplate('');
    }
  };

  const handleMappingChange = (systemField: string, excelColumn: string) => {
    setMappings(mappings.map(m => 
      m.systemField === systemField ? { ...m, excelColumn } : m
    ));
    setSelectedTemplate(''); // Clear template selection when manually editing
  };

  const handleApply = () => {
    onApplyMapping(mappings);
    onOpenChange(false);
  };

  // Handle file upload to detect columns
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
        
        if (jsonData.length > 0) {
          const headers = jsonData[0].map(h => String(h || '').trim()).filter(Boolean);
          setDetectedColumns(headers);
          autoMatchColumns(headers);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  // Export current mapping as a custom template file
  const handleExportTemplate = () => {
    const data = fields.map(f => {
      const mapping = mappings.find(m => m.systemField === f.key);
      return {
        'Campo do Sistema': f.label,
        'Sua Coluna Excel': mapping?.excelColumn || '',
        'Obrigatório': f.required ? 'Sim' : 'Não',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mapeamento');

    // Add sample data sheet
    const sampleData = [fields.reduce((acc, f) => {
      const mapping = mappings.find(m => m.systemField === f.key);
      acc[mapping?.excelColumn || f.label] = f.key === 'preco' || f.key === 'custo' ? 1000 :
        f.key === 'quantidade' || f.key === 'iva' ? 14 :
        f.key === 'limiteCredito' ? 500000 : `Exemplo ${f.label}`;
      return acc;
    }, {} as Record<string, any>)];

    const wsSample = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, wsSample, 'Dados Exemplo');

    XLSX.writeFile(wb, `template_${type}_personalizado.xlsx`);
  };

  const requiredFieldsMapped = mappings.filter(m => m.required && m.excelColumn).length;
  const totalRequired = mappings.filter(m => m.required).length;
  const allRequiredMapped = requiredFieldsMapped === totalRequired;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Mapeamento de Colunas - {typeLabel}
          </DialogTitle>
          <DialogDescription>
            Configure como as colunas do seu ficheiro Excel correspondem aos campos do sistema
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Saved Templates */}
          <div className="space-y-2">
            <Label>Templates Guardados</Label>
            <div className="flex gap-2">
              <Select value={selectedTemplate} onValueChange={handleLoadTemplate}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecionar template guardado..." />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {templates.length === 0 ? (
                    <SelectItem value="_none" disabled>Nenhum template guardado</SelectItem>
                  ) : (
                    templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedTemplate && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleDeleteTemplate(selectedTemplate)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* File Upload for Column Detection */}
          {detectedColumns.length === 0 && (
            <Alert>
              <Upload className="h-4 w-4" />
              <AlertDescription>
                <label className="cursor-pointer underline text-primary">
                  Carregue um ficheiro Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {' '}para detectar automaticamente as colunas disponíveis.
              </AlertDescription>
            </Alert>
          )}

          {detectedColumns.length > 0 && (
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Colunas detectadas no seu ficheiro:</Label>
              <div className="flex flex-wrap gap-1">
                {detectedColumns.map((col, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{col}</Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Mapping Configuration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Configuração do Mapeamento</Label>
              <div className="flex items-center gap-1 text-sm">
                {allRequiredMapped ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                )}
                <span className={allRequiredMapped ? 'text-green-600' : 'text-amber-600'}>
                  {requiredFieldsMapped}/{totalRequired} campos obrigatórios
                </span>
              </div>
            </div>

            <ScrollArea className="h-[280px] border rounded-lg p-3">
              <div className="space-y-3">
                {fields.map(field => {
                  const mapping = mappings.find(m => m.systemField === field.key);
                  const isMapped = !!mapping?.excelColumn;

                  return (
                    <div key={field.key} className="flex items-center gap-3">
                      <div className="w-[180px] flex items-center gap-2">
                        <span className={`text-sm ${field.required ? 'font-medium' : ''}`}>
                          {field.label}
                        </span>
                        {field.required && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1">
                            Obrigatório
                          </Badge>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <Select
                        value={mapping?.excelColumn || '_none'}
                        onValueChange={(val) => handleMappingChange(field.key, val === '_none' ? '' : val)}
                      >
                        <SelectTrigger className={`flex-1 ${isMapped ? 'border-green-500' : field.required ? 'border-amber-500' : ''}`}>
                          <SelectValue placeholder="Selecionar coluna..." />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          <SelectItem value="_none">-- Não mapear --</SelectItem>
                          {detectedColumns.map((col, i) => (
                            <SelectItem key={i} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isMapped && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Save Template Form */}
          {showSaveForm ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nome do template..."
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" onClick={handleSaveTemplate} disabled={!templateName.trim()}>
                <Save className="w-4 h-4 mr-1" />
                Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSaveForm(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSaveForm(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Guardar Template
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportTemplate}>
                <Download className="w-4 h-4 mr-1" />
                Exportar Template Excel
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={!allRequiredMapped}>
            <Check className="w-4 h-4 mr-2" />
            Aplicar Mapeamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}