// Supplier Returns Types and Storage
// DUAL-MODE: Electron → SQLite | Web → localStorage
import { PurchaseOrder, PurchaseOrderItem } from '@/types/erp';
import { isElectronMode, dbGetAll, dbInsert, lsGet, lsSet } from '@/lib/dbHelper';

export interface SupplierReturn {
  id: string;
  returnNumber: string;
  branchId: string;
  branchName: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  supplierId: string;
  supplierName: string;
  reason: 'damaged' | 'wrong_item' | 'quality' | 'overstock' | 'other';
  reasonDescription: string;
  items: SupplierReturnItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  status: 'pending' | 'approved' | 'shipped' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  shippedAt?: string;
  completedAt?: string;
  notes?: string;
}

export interface SupplierReturnItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  reason?: string;
}

const STORAGE_KEY = 'kwanzaerp_supplier_returns';

export async function getSupplierReturns(branchId?: string): Promise<SupplierReturn[]> {
  if (isElectronMode()) {
    const rows = await dbGetAll<any>('supplier_returns');
    let returns = rows.map(mapReturnFromDb);
    if (branchId) returns = returns.filter(r => r.branchId === branchId);
    return returns;
  }
  const returns = lsGet<SupplierReturn[]>(STORAGE_KEY, []);
  return branchId ? returns.filter(r => r.branchId === branchId) : returns;
}

export async function saveSupplierReturn(returnDoc: SupplierReturn): Promise<void> {
  if (isElectronMode()) {
    await dbInsert('supplier_returns', mapReturnToDb(returnDoc));
    return;
  }
  const returns = lsGet<SupplierReturn[]>(STORAGE_KEY, []);
  const index = returns.findIndex(r => r.id === returnDoc.id);
  if (index >= 0) {
    returns[index] = returnDoc;
  } else {
    returns.push(returnDoc);
  }
  lsSet(STORAGE_KEY, returns);
}

export function generateSupplierReturnNumber(branchCode: string): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = Date.now().toString().slice(-4);
  return `DF ${branchCode}/${today}/${seq}`;
}

// DB mappers
function mapReturnFromDb(row: any): SupplierReturn {
  return {
    id: row.id,
    returnNumber: row.return_number || '',
    branchId: row.branch_id || '',
    branchName: row.branch_name || '',
    purchaseOrderId: row.purchase_order_id || '',
    purchaseOrderNumber: row.purchase_order_number || '',
    supplierId: row.supplier_id || '',
    supplierName: row.supplier_name || '',
    reason: row.reason || 'other',
    reasonDescription: row.reason_description || '',
    items: row.items_json ? JSON.parse(row.items_json) : [],
    subtotal: Number(row.subtotal || 0),
    taxAmount: Number(row.tax_amount || 0),
    total: Number(row.total || 0),
    status: row.status || 'pending',
    createdBy: row.created_by || '',
    createdAt: row.created_at || '',
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    shippedAt: row.shipped_at,
    completedAt: row.completed_at,
    notes: row.notes,
  };
}

function mapReturnToDb(ret: SupplierReturn): any {
  return {
    id: ret.id,
    return_number: ret.returnNumber,
    branch_id: ret.branchId,
    branch_name: ret.branchName,
    purchase_order_id: ret.purchaseOrderId,
    purchase_order_number: ret.purchaseOrderNumber,
    supplier_id: ret.supplierId,
    supplier_name: ret.supplierName,
    reason: ret.reason,
    reason_description: ret.reasonDescription,
    items_json: JSON.stringify(ret.items),
    subtotal: ret.subtotal,
    tax_amount: ret.taxAmount,
    total: ret.total,
    status: ret.status,
    created_by: ret.createdBy,
    approved_by: ret.approvedBy || '',
    approved_at: ret.approvedAt || '',
    shipped_at: ret.shippedAt || '',
    completed_at: ret.completedAt || '',
    notes: ret.notes || '',
  };
}
