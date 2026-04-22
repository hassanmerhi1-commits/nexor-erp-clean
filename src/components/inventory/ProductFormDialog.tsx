import { useState, useEffect } from 'react';
import { Product } from '@/types/erp';
import { useBranches, useCategories } from '@/hooks/useERP';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (product: Product) => void;
}

const UNITS = [
  { value: 'un', label: 'Unidade' },
  { value: 'kg', label: 'Quilograma' },
  { value: 'g', label: 'Grama' },
  { value: 'l', label: 'Litro' },
  { value: 'ml', label: 'Mililitro' },
  { value: 'cx', label: 'Caixa' },
  { value: 'pct', label: 'Pacote' },
];

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSave,
}: ProductFormDialogProps) {
  const { branches } = useBranches();
  const { categories } = useCategories();
  const { toast } = useToast();
  
  const activeCategories = categories.filter(c => c.isActive);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: '',
    price: 0,
    cost: 0,
    stock: 0,
    minStock: 0,
    maxStock: 0,
    unit: 'un',
    taxRate: 14,
    branchId: 'all',
    isActive: true,
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || '',
        category: product.category,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        minStock: product.minStock || 0,
        maxStock: product.maxStock || 0,
        unit: product.unit,
        taxRate: product.taxRate,
        branchId: product.branchId,
        isActive: product.isActive,
      });
    } else {
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        category: 'Alimentação',
        price: 0,
        cost: 0,
        stock: 0,
        minStock: 0,
        maxStock: 0,
        unit: 'un',
        taxRate: 14,
        branchId: 'all',
        isActive: true,
      });
    }
  }, [product, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.sku.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome e SKU são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (formData.price < 0 || formData.cost < 0) {
      toast({
        title: 'Erro',
        description: 'Preço e custo não podem ser negativos',
        variant: 'destructive',
      });
      return;
    }

    const savedProduct: Product = {
      id: product?.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: formData.name.trim(),
      sku: formData.sku.trim().toUpperCase(),
      barcode: formData.barcode.trim() || undefined,
      category: formData.category,
      price: formData.price,
      cost: formData.cost,
      firstCost: product?.firstCost || formData.cost,
      lastCost: formData.cost,
      avgCost: product?.avgCost || formData.cost,
      stock: formData.stock,
      minStock: formData.minStock || undefined,
      maxStock: formData.maxStock || undefined,
      unit: formData.unit,
      taxRate: formData.taxRate,
      branchId: formData.branchId,
      isActive: formData.isActive,
      createdAt: product?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(savedProduct);
    onOpenChange(false);
    
    toast({
      title: product ? 'Produto actualizado' : 'Produto criado',
      description: `${savedProduct.name} foi ${product ? 'actualizado' : 'criado'} com sucesso`,
    });
  };

  const preventWheelValueChange = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

  const margin = formData.price > 0 && formData.cost > 0
    ? (((formData.price - formData.cost) / formData.cost) * 100).toFixed(1)
    : '0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <form onSubmit={handleSubmit} className="flex max-h-[85dvh] flex-col">
          <DialogHeader className="px-6 pt-6 pb-3">
            <DialogTitle>{product ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            <DialogDescription>
              Atualize os dados do produto e role com o mouse normalmente pela lista de campos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Nome do Produto *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Arroz Tio João 1kg"
                />
              </div>

              <div>
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  placeholder="Ex: ARR-001"
                />
              </div>

              <div>
                <Label htmlFor="barcode">Código de Barras</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="Ex: 7891234567890"
                />
              </div>

              <div>
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cat.color || '#6b7280' }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="unit">Unidade</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="cost">Custo (Kz) *</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost}
                  onWheel={preventWheelValueChange}
                  onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="price">Preço de Venda (Kz) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onWheel={preventWheelValueChange}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="taxRate">Taxa IVA (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.taxRate}
                  onWheel={preventWheelValueChange}
                  onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="margin">Margem de Lucro</Label>
                <div id="margin" className="h-10 px-3 py-2 bg-muted rounded-md flex items-center font-medium">
                  {margin}%
                </div>
              </div>

              <div>
                <Label htmlFor="stock">Stock Inicial</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={formData.stock}
                  onWheel={preventWheelValueChange}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="minStock">Stock Mínimo</Label>
                  <Input
                    id="minStock"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.minStock || ''}
                    onWheel={preventWheelValueChange}
                    onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="maxStock">Stock Máximo</Label>
                  <Input
                    id="maxStock"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.maxStock || ''}
                    onWheel={preventWheelValueChange}
                    onChange={(e) => setFormData({ ...formData, maxStock: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="branch">Filial</Label>
                <Select
                  value={formData.branchId}
                  onValueChange={(value) => setFormData({ ...formData, branchId: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Filiais</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 flex items-center gap-3">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Produto Activo</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t px-6 py-4 bg-background">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {product ? 'Guardar Alterações' : 'Criar Produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}