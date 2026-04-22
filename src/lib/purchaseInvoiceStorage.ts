/**
 * Purchase Invoice (Fatura de Compra) Storage — API-First
 */

import { Product } from '@/types/erp';
import { api } from '@/lib/api/client';
import { isElectronMode, dbGetAll, dbInsert, dbDelete as dbDeleteRow, lsGet, lsSet } from '@/lib/dbHelper';

const STORAGE_KEY = 'kwanzaerp_purchase_invoices';

export interface PurchaseInvoiceLine {
  id: string;
  productId: string;
  productCode: string;
  description: string;
  quantity: number;
  packaging: number;
  unitPrice: number;
  discountPct: number;
  discountPct2: number;
  totalQty: number;
  total: number;
  ivaRate: number;
  ivaAmount: number;
  totalWithIva: number;
  warehouseId: string;
  warehouseName: string;
  currentStock: number;
  unit: string;
  barcode?: string;
}

export interface PurchaseInvoiceJournalLine {
  id: string;
  accountCode: string;
  accountName: string;
  currency: string;
  note: string;
  debit: number;
  credit: number;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierAccountCode: string;
  supplierName: string;
  supplierNif?: string;
  supplierPhone?: string;
  supplierBalance: number;
  ref?: string;
  supplierInvoiceNo?: string;
  contact?: string;
  department?: string;
  ref2?: string;
  date: string;
  paymentDate: string;
  project?: string;
  currency: string;
  warehouseId: string;
  warehouseName: string;
  priceType: 'last_price' | 'average_price' | 'manual';
  address?: string;
  purchaseAccountCode: string;
  ivaAccountCode: string;
  transactionType: string;
  currencyRate: number;
  taxRate2: number;
  orderNo?: string;
  surchargePercent: number;
  changePrice: boolean;
  isPending: boolean;
  extraNote?: string;
  lines: PurchaseInvoiceLine[];
  journalLines: PurchaseInvoiceJournalLine[];
  subtotal: number;
  ivaTotal: number;
  total: number;
  status: 'draft' | 'confirmed' | 'cancelled';
  branchId: string;
  branchName: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- CRUD ----------

export async function getPurchaseInvoices(branchId?: string): Promise<PurchaseInvoice[]> {
  if (isElectronMode()) {
    const rows = await dbGetAll<any>('purchase_invoices');
    let docs = rows.map(mapPIFromDb);
    if (branchId) docs = docs.filter(d => d.branchId === branchId);
    return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  let docs = lsGet<PurchaseInvoice[]>(STORAGE_KEY, []);
  if (branchId) docs = docs.filter(d => d.branchId === branchId);
  return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getPurchaseInvoiceById(id: string): Promise<PurchaseInvoice | undefined> {
  const all = await getPurchaseInvoices();
  return all.find(d => d.id === id);
}

export function generatePurchaseInvoiceNumber(branchCode: string): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const seq = Date.now().toString().slice(-4);
  return `FC-${branchCode}-${date}-${seq}`;
}

export async function savePurchaseInvoice(invoice: PurchaseInvoice): Promise<PurchaseInvoice> {
  if (isElectronMode()) {
    await dbInsert('purchase_invoices', mapPIToDb(invoice));
    return invoice;
  }
  const all = lsGet<PurchaseInvoice[]>(STORAGE_KEY, []);
  const idx = all.findIndex(d => d.id === invoice.id);
  if (idx >= 0) {
    all[idx] = { ...invoice, updatedAt: new Date().toISOString() };
  } else {
    all.push(invoice);
  }
  lsSet(STORAGE_KEY, all);
  return invoice;
}

export async function deletePurchaseInvoice(id: string): Promise<void> {
  if (isElectronMode()) {
    await dbDeleteRow('purchase_invoices', id);
    return;
  }
  lsSet(STORAGE_KEY, lsGet<PurchaseInvoice[]>(STORAGE_KEY, []).filter(d => d.id !== id));
}

// ---------- Line calculations ----------

export function calculateLine(line: Partial<PurchaseInvoiceLine>): PurchaseInvoiceLine {
  const qty = line.quantity || 0;
  const pkg = line.packaging || 1;
  const price = line.unitPrice || 0;
  const disc1 = line.discountPct || 0;
  const disc2 = line.discountPct2 || 0;
  const ivaRate = line.ivaRate || 0;

  const totalQty = qty * pkg;
  const gross = totalQty * price;
  const afterDisc1 = gross * (1 - disc1 / 100);
  const afterDisc2 = afterDisc1 * (1 - disc2 / 100);
  const ivaAmount = afterDisc2 * (ivaRate / 100);
  const totalWithIva = afterDisc2 + ivaAmount;

  return {
    id: line.id || `line_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    productId: line.productId || '',
    productCode: line.productCode || '',
    description: line.description || '',
    quantity: qty,
    packaging: pkg,
    unitPrice: price,
    discountPct: disc1,
    discountPct2: disc2,
    totalQty,
    total: Math.round(afterDisc2 * 100) / 100,
    ivaRate,
    ivaAmount: Math.round(ivaAmount * 100) / 100,
    totalWithIva: Math.round(totalWithIva * 100) / 100,
    warehouseId: line.warehouseId || '',
    warehouseName: line.warehouseName || '',
    currentStock: line.currentStock || 0,
    unit: line.unit || 'UN',
    barcode: line.barcode,
  };
}

export function calculateInvoiceTotals(lines: PurchaseInvoiceLine[]) {
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const ivaTotal = lines.reduce((s, l) => s + l.ivaAmount, 0);
  const total = lines.reduce((s, l) => s + l.totalWithIva, 0);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    ivaTotal: Math.round(ivaTotal * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

// ---------- Phase 2: Stock update via API ----------

export async function applyStockUpdate(invoice: PurchaseInvoice): Promise<void> {
  for (const line of invoice.lines) {
    if (!line.productId || line.totalQty <= 0) continue;
    
    try {
      await api.transactions.createStockMovement({
        productId: line.productId,
        warehouseId: invoice.branchId,
        movementType: 'IN',
        quantity: line.totalQty,
        unitCost: line.unitPrice,
        referenceType: 'purchase',
        referenceId: invoice.id,
        referenceNumber: invoice.invoiceNumber,
        notes: `Fatura de Compra ${invoice.invoiceNumber} - ${invoice.supplierName}`,
        createdBy: invoice.createdBy,
      });
    } catch {
      // Fallback: direct stock update
      await api.products.updateStock(line.productId, line.totalQty);
    }
  }
}

// ---------- Phase 5: Update product purchase price via API ----------

export async function applyPriceUpdate(invoice: PurchaseInvoice): Promise<void> {
  if (!invoice.changePrice) return;
  
  for (const line of invoice.lines) {
    if (!line.productId) continue;
    
    try {
      // Get current product data
      const productsResponse = await api.products.list();
      const products = productsResponse.data || [];
      const product = products.find((p: any) => p.id === line.productId);
      if (!product) continue;

      const currentStock = product.stock || 0;
      const previousStock = Math.max(currentStock - line.totalQty, 0);
      const previousAverageCost = product.avgCost || product.cost || 0;
      const previousTotalValue = previousStock * previousAverageCost;
      const newItemsTotalValue = line.totalQty * line.unitPrice;
      const newTotalStock = previousStock + line.totalQty;
      const newAvgCost = newTotalStock > 0
        ? (previousTotalValue + newItemsTotalValue) / newTotalStock
        : line.unitPrice;

      await api.products.update(line.productId, {
        cost: newAvgCost,
        avgCost: newAvgCost,
        lastCost: line.unitPrice,
        firstCost: product.firstCost || line.unitPrice,
      });
    } catch (err) {
      console.error('[PurchaseInvoice] Price update failed:', err);
    }
  }
}

// ---------- Phase 3: Auto journal entry ----------

export function generateAutoJournalLines(invoice: PurchaseInvoice): PurchaseInvoiceJournalLine[] {
  const lines: PurchaseInvoiceJournalLine[] = [];

  if (invoice.subtotal > 0) {
    lines.push({
      id: `jl_${Date.now()}_1`,
      accountCode: invoice.purchaseAccountCode || '2.1.1',
      accountName: 'Compra de Mercadorias',
      currency: invoice.currency,
      note: `FC ${invoice.invoiceNumber} - ${invoice.supplierName}`,
      debit: invoice.subtotal,
      credit: 0,
    });
  }

  if (invoice.ivaTotal > 0) {
    lines.push({
      id: `jl_${Date.now()}_2`,
      accountCode: invoice.ivaAccountCode || '3.3.1',
      accountName: 'IVA Dedutível',
      currency: invoice.currency,
      note: `IVA - FC ${invoice.invoiceNumber}`,
      debit: invoice.ivaTotal,
      credit: 0,
    });
  }

  lines.push({
    id: `jl_${Date.now()}_3`,
    accountCode: invoice.supplierAccountCode,
    accountName: invoice.supplierName,
    currency: invoice.currency,
    note: `FC ${invoice.invoiceNumber}`,
    debit: 0,
    credit: invoice.total,
  });

  return lines;
}

// ---------- Phase 6: Update supplier balance via API ----------

export async function applySupplierBalanceUpdate(invoice: PurchaseInvoice): Promise<void> {
  if (invoice.total <= 0) return;
  
  try {
    const response = await api.suppliers.list();
    const suppliers = response.data || [];
    const supplier = suppliers.find(
      (s: any) => s.id === invoice.supplierAccountCode || s.name === invoice.supplierName || s.nif === invoice.supplierNif
    );
    if (!supplier) {
      console.warn(`[PurchaseInvoice] Supplier not found: ${invoice.supplierName}`);
      return;
    }
    const newBalance = (supplier.balance || 0) + invoice.total;
    await api.suppliers.update(supplier.id, { balance: newBalance });
    console.log(`[PurchaseInvoice] Updated supplier ${supplier.name} balance: ${supplier.balance} → ${newBalance}`);
  } catch (err) {
    console.error('[PurchaseInvoice] Supplier balance update failed:', err);
  }
}

// DB mappers
function mapPIFromDb(row: any): PurchaseInvoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number || '',
    supplierAccountCode: row.supplier_account_code || '',
    supplierName: row.supplier_name || '',
    supplierNif: row.supplier_nif,
    supplierPhone: row.supplier_phone,
    supplierBalance: Number(row.supplier_balance || 0),
    ref: row.ref,
    supplierInvoiceNo: row.supplier_invoice_no,
    contact: row.contact,
    department: row.department,
    ref2: row.ref2,
    date: row.date || '',
    paymentDate: row.payment_date || '',
    project: row.project,
    currency: row.currency || 'AOA',
    warehouseId: row.warehouse_id || '',
    warehouseName: row.warehouse_name || '',
    priceType: row.price_type || 'last_price',
    address: row.address,
    purchaseAccountCode: row.purchase_account_code || '2.1.1',
    ivaAccountCode: row.iva_account_code || '3.3.1',
    transactionType: row.transaction_type || 'ALL',
    currencyRate: Number(row.currency_rate || 1),
    taxRate2: Number(row.tax_rate_2 || 0),
    orderNo: row.order_no,
    surchargePercent: Number(row.surcharge_percent || 0),
    changePrice: !!row.change_price,
    isPending: !!row.is_pending,
    extraNote: row.extra_note,
    lines: row.lines_json ? JSON.parse(row.lines_json) : [],
    journalLines: row.journal_lines_json ? JSON.parse(row.journal_lines_json) : [],
    subtotal: Number(row.subtotal || 0),
    ivaTotal: Number(row.iva_total || 0),
    total: Number(row.total || 0),
    status: row.status || 'draft',
    branchId: row.branch_id || '',
    branchName: row.branch_name || '',
    createdBy: row.created_by || '',
    createdByName: row.created_by_name || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function mapPIToDb(invoice: PurchaseInvoice): any {
  return {
    id: invoice.id,
    invoice_number: invoice.invoiceNumber,
    supplier_account_code: invoice.supplierAccountCode,
    supplier_name: invoice.supplierName,
    supplier_nif: invoice.supplierNif || '',
    supplier_phone: invoice.supplierPhone || '',
    supplier_balance: invoice.supplierBalance,
    ref: invoice.ref || '',
    supplier_invoice_no: invoice.supplierInvoiceNo || '',
    date: invoice.date,
    payment_date: invoice.paymentDate,
    currency: invoice.currency,
    warehouse_id: invoice.warehouseId,
    warehouse_name: invoice.warehouseName,
    price_type: invoice.priceType,
    purchase_account_code: invoice.purchaseAccountCode,
    iva_account_code: invoice.ivaAccountCode,
    transaction_type: invoice.transactionType,
    currency_rate: invoice.currencyRate,
    tax_rate_2: invoice.taxRate2,
    surcharge_percent: invoice.surchargePercent,
    change_price: invoice.changePrice ? 1 : 0,
    is_pending: invoice.isPending ? 1 : 0,
    extra_note: invoice.extraNote || '',
    lines_json: JSON.stringify(invoice.lines),
    journal_lines_json: JSON.stringify(invoice.journalLines),
    subtotal: invoice.subtotal,
    iva_total: invoice.ivaTotal,
    total: invoice.total,
    status: invoice.status,
    branch_id: invoice.branchId,
    branch_name: invoice.branchName,
    created_by: invoice.createdBy,
    created_by_name: invoice.createdByName,
  };
}
