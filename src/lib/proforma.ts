// Pro Forma storage and management for Kwanza ERP
// DUAL-MODE: Electron → SQLite | Web → localStorage
import { ProForma, ProFormaItem } from '@/types/proforma';
import { isElectronMode, dbGetAll, dbInsert, dbDelete as dbDeleteRow, lsGet, lsSet } from '@/lib/dbHelper';

const STORAGE_KEY = 'kwanzaerp_proformas';

// Pro Forma CRUD
export async function getProFormas(branchId?: string): Promise<ProForma[]> {
  if (isElectronMode()) {
    const rows = await dbGetAll<any>('proformas');
    const items = await dbGetAll<any>('proforma_items');
    let proformas = rows.map(r => ({
      ...mapProformaFromDb(r),
      items: items.filter((i: any) => i.proforma_id === r.id).map(mapProformaItemFromDb),
    }));
    if (branchId) proformas = proformas.filter(p => p.branchId === branchId);
    return proformas;
  }
  const proformas = lsGet<ProForma[]>(STORAGE_KEY, []);
  return branchId ? proformas.filter(p => p.branchId === branchId) : proformas;
}

export async function getProFormaById(id: string): Promise<ProForma | undefined> {
  const proformas = await getProFormas();
  return proformas.find(p => p.id === id);
}

export async function saveProForma(proforma: ProForma): Promise<void> {
  if (isElectronMode()) {
    await dbInsert('proformas', mapProformaToDb(proforma));
    // Save items
    for (const item of proforma.items || []) {
      await dbInsert('proforma_items', {
        id: item.id || `pi_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        proforma_id: proforma.id,
        product_id: item.productId || '',
        product_name: item.productName || item.description || '',
        description: item.description || '',
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount: item.discount || 0,
        tax_rate: item.taxRate,
        tax_amount: item.taxAmount || 0,
        total: item.total || 0,
        branch_id: proforma.branchId || '',
      });
    }
    return;
  }
  const proformas = lsGet<ProForma[]>(STORAGE_KEY, []);
  const index = proformas.findIndex(p => p.id === proforma.id);
  if (index >= 0) {
    proformas[index] = { ...proforma, updatedAt: new Date().toISOString() };
  } else {
    proformas.push(proforma);
  }
  lsSet(STORAGE_KEY, proformas);
}

export async function deleteProForma(id: string): Promise<void> {
  if (isElectronMode()) {
    await dbDeleteRow('proformas', id);
    return;
  }
  const proformas = lsGet<ProForma[]>(STORAGE_KEY, []);
  lsSet(STORAGE_KEY, proformas.filter(p => p.id !== id));
}

export function generateProFormaNumber(branchCode: string): string {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = Date.now().toString().slice(-4);
  return `OR ${branchCode}/${dateStr}/${seq}`;
}

// Calculate totals for items
export function calculateProFormaTotals(items: ProFormaItem[]): {
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  let subtotal = 0;
  let taxAmount = 0;
  
  items.forEach(item => {
    const itemSubtotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
    const itemTax = itemSubtotal * (item.taxRate / 100);
    subtotal += itemSubtotal;
    taxAmount += itemTax;
  });
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round((subtotal + taxAmount) * 100) / 100,
  };
}

export async function updateExpiredProFormas(): Promise<void> {
  const proformas = await getProFormas();
  const now = new Date();
  
  for (const p of proformas) {
    if (['draft', 'sent'].includes(p.status) && new Date(p.validUntil) < now) {
      p.status = 'expired';
      p.updatedAt = now.toISOString();
      await saveProForma(p);
    }
  }
}

export async function getProFormaStats(branchId?: string): Promise<{
  total: number; draft: number; sent: number; accepted: number;
  converted: number; expired: number; totalValue: number; pendingValue: number;
}> {
  const proformas = await getProFormas(branchId);
  
  return {
    total: proformas.length,
    draft: proformas.filter(p => p.status === 'draft').length,
    sent: proformas.filter(p => p.status === 'sent').length,
    accepted: proformas.filter(p => p.status === 'accepted').length,
    converted: proformas.filter(p => p.status === 'converted').length,
    expired: proformas.filter(p => p.status === 'expired').length,
    totalValue: proformas.reduce((sum, p) => sum + p.total, 0),
    pendingValue: proformas
      .filter(p => ['draft', 'sent', 'accepted'].includes(p.status))
      .reduce((sum, p) => sum + p.total, 0),
  };
}

// DB mappers
function mapProformaFromDb(row: any): ProForma {
  return {
    id: row.id,
    documentNumber: row.proforma_number || '',
    branchId: row.branch_id || '',
    branchName: '',
    customerName: row.client_name || '',
    customerNif: row.client_nif || '',
    clientId: row.client_id || '',
    clientName: row.client_name || '',
    clientNif: row.client_nif || '',
    items: [],
    subtotal: Number(row.subtotal || 0),
    taxAmount: Number(row.tax_amount || 0),
    discount: Number(row.discount || 0),
    total: Number(row.total || 0),
    currency: row.currency || 'AOA',
    status: row.status || 'draft',
    validUntil: row.valid_until || '',
    notes: row.notes || '',
    createdBy: row.created_by || '',
    createdByName: '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function mapProformaToDb(proforma: ProForma): any {
  return {
    id: proforma.id,
    proforma_number: proforma.documentNumber,
    client_id: proforma.clientId || '',
    client_name: proforma.clientName || '',
    client_nif: proforma.clientNif || '',
    branch_id: proforma.branchId || '',
    subtotal: proforma.subtotal,
    tax_amount: proforma.taxAmount,
    discount: proforma.discount || 0,
    total: proforma.total,
    currency: proforma.currency || 'AOA',
    status: proforma.status,
    valid_until: proforma.validUntil || '',
    notes: proforma.notes || '',
    created_by: proforma.createdBy || '',
  };
}

function mapProformaItemFromDb(row: any): ProFormaItem {
  return {
    id: row.id,
    productId: row.product_id || '',
    productName: row.product_name || '',
    sku: row.sku || '',
    description: row.description || row.product_name || '',
    quantity: Number(row.quantity || 0),
    unitPrice: Number(row.unit_price || 0),
    discount: Number(row.discount || 0),
    taxRate: Number(row.tax_rate || 14),
    taxAmount: Number(row.tax_amount || 0),
    subtotal: Number(row.subtotal || 0),
    total: Number(row.total || 0),
  };
}
