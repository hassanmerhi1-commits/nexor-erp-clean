// Fiscal Documents Hooks for AGT Compliance — API-First
import { useState, useEffect, useCallback } from 'react';
import { 
  CreditNote, 
  CreditNoteItem,
  DebitNote, 
  DebitNoteItem,
  TransportDocument, 
  TransportDocumentItem,
  CompanyInfo,
  SAFTExport,
  Sale
} from '@/types/erp';
import * as fiscalStorage from '@/lib/fiscalDocuments';
import { api } from '@/lib/api/client';

// ==================== CREDIT NOTES ====================

export function useCreditNotes(branchId?: string) {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);

  const refreshCreditNotes = useCallback(() => {
    setCreditNotes(fiscalStorage.getCreditNotes(branchId));
  }, [branchId]);

  useEffect(() => {
    refreshCreditNotes();
  }, [refreshCreditNotes]);

  const createCreditNote = useCallback(async (
    branchId: string,
    branchCode: string,
    originalSale: Sale,
    reason: CreditNote['reason'],
    reasonDescription: string,
    items: CreditNoteItem[],
    issuedBy: string,
    restoreStock: boolean = true
  ): Promise<CreditNote> => {
    // Get branches from API
    let branches: any[] = [];
    try {
      const response = await api.branches.list();
      branches = response.data || [];
    } catch {
      const raw = localStorage.getItem('kwanzaerp_branches');
      branches = raw ? JSON.parse(raw) : [];
    }
    const branch = branches.find((b: any) => b.id === branchId);
    const previousHash = await fiscalStorage.getLastDocumentHash('credit');
    const documentNumber = fiscalStorage.generateCreditNoteNumber(branchCode);
    
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const total = subtotal + taxAmount;

    const creditNote: CreditNote = {
      id: `cn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentNumber,
      branchId,
      branchName: branch?.name || '',
      originalInvoiceId: originalSale.id,
      originalInvoiceNumber: originalSale.invoiceNumber,
      reason,
      reasonDescription,
      items,
      subtotal,
      taxAmount,
      total,
      customerNif: originalSale.customerNif,
      customerName: originalSale.customerName,
      status: 'issued',
      issuedBy,
      issuedAt: new Date().toISOString(),
      saftHash: fiscalStorage.generateDocumentHash(
        previousHash,
        new Date().toISOString().split('T')[0],
        documentNumber,
        total
      ),
      createdAt: new Date().toISOString(),
    };

    fiscalStorage.saveCreditNote(creditNote);

    // Restore stock via API
    if (restoreStock) {
      for (const item of items) {
        try {
          await api.transactions.createStockMovement({
            productId: item.productId,
            movementType: 'IN',
            quantity: item.quantity,
            referenceType: 'return',
            referenceId: creditNote.id,
            referenceNumber: documentNumber,
            notes: `Nota de Crédito: ${reasonDescription}`,
          });
        } catch {
          // Fallback: update stock via products API
          await api.products.updateStock(item.productId, item.quantity);
        }
      }
    }

    refreshCreditNotes();
    return creditNote;
  }, [refreshCreditNotes]);

  const cancelCreditNote = useCallback((noteId: string) => {
    const notes = fiscalStorage.getCreditNotes();
    const note = notes.find(n => n.id === noteId);
    if (note && note.status === 'draft') {
      note.status = 'cancelled';
      fiscalStorage.saveCreditNote(note);
      refreshCreditNotes();
    }
  }, [refreshCreditNotes]);

  return { creditNotes, createCreditNote, cancelCreditNote, refreshCreditNotes };
}

// ==================== DEBIT NOTES ====================

export function useDebitNotes(branchId?: string) {
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);

  const refreshDebitNotes = useCallback(() => {
    setDebitNotes(fiscalStorage.getDebitNotes(branchId));
  }, [branchId]);

  useEffect(() => {
    refreshDebitNotes();
  }, [refreshDebitNotes]);

  const createDebitNote = useCallback(async (
    branchId: string,
    branchCode: string,
    originalSale: Sale | null,
    reason: DebitNote['reason'],
    reasonDescription: string,
    items: DebitNoteItem[],
    issuedBy: string,
    customerNif?: string,
    customerName?: string
  ): Promise<DebitNote> => {
    let branches: any[] = [];
    try {
      const response = await api.branches.list();
      branches = response.data || [];
    } catch {
      const raw = localStorage.getItem('kwanzaerp_branches');
      branches = raw ? JSON.parse(raw) : [];
    }
    const branch = branches.find((b: any) => b.id === branchId);
    const previousHash = await fiscalStorage.getLastDocumentHash('debit');
    const documentNumber = fiscalStorage.generateDebitNoteNumber(branchCode);
    
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const total = subtotal + taxAmount;

    const debitNote: DebitNote = {
      id: `dn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentNumber,
      branchId,
      branchName: branch?.name || '',
      originalInvoiceId: originalSale?.id,
      originalInvoiceNumber: originalSale?.invoiceNumber,
      reason,
      reasonDescription,
      items,
      subtotal,
      taxAmount,
      total,
      customerNif: customerNif || originalSale?.customerNif,
      customerName: customerName || originalSale?.customerName,
      status: 'issued',
      issuedBy,
      issuedAt: new Date().toISOString(),
      saftHash: fiscalStorage.generateDocumentHash(
        previousHash,
        new Date().toISOString().split('T')[0],
        documentNumber,
        total
      ),
      createdAt: new Date().toISOString(),
    };

    fiscalStorage.saveDebitNote(debitNote);
    refreshDebitNotes();
    return debitNote;
  }, [refreshDebitNotes]);

  const cancelDebitNote = useCallback((noteId: string) => {
    const notes = fiscalStorage.getDebitNotes();
    const note = notes.find(n => n.id === noteId);
    if (note && note.status === 'draft') {
      note.status = 'cancelled';
      fiscalStorage.saveDebitNote(note);
      refreshDebitNotes();
    }
  }, [refreshDebitNotes]);

  return { debitNotes, createDebitNote, cancelDebitNote, refreshDebitNotes };
}

// ==================== TRANSPORT DOCUMENTS ====================

export function useTransportDocuments(branchId?: string) {
  const [transportDocs, setTransportDocs] = useState<TransportDocument[]>([]);

  const refreshTransportDocs = useCallback(() => {
    setTransportDocs(fiscalStorage.getTransportDocuments(branchId));
  }, [branchId]);

  useEffect(() => {
    refreshTransportDocs();
  }, [refreshTransportDocs]);

  const createTransportDocument = useCallback(async (
    branchId: string,
    branchCode: string,
    type: TransportDocument['type'],
    originAddress: string,
    originCity: string,
    destinationAddress: string,
    destinationCity: string,
    loadingDate: string,
    loadingTime: string,
    items: TransportDocumentItem[],
    issuedBy: string,
    options?: {
      destinationNif?: string;
      destinationName?: string;
      transporterName?: string;
      transporterNif?: string;
      vehiclePlate?: string;
      relatedInvoiceId?: string;
      relatedInvoiceNumber?: string;
      notes?: string;
      totalWeight?: number;
      totalVolume?: number;
    }
  ): Promise<TransportDocument> => {
    let branches: any[] = [];
    try {
      const response = await api.branches.list();
      branches = response.data || [];
    } catch {
      const raw = localStorage.getItem('kwanzaerp_branches');
      branches = raw ? JSON.parse(raw) : [];
    }
    const branch = branches.find((b: any) => b.id === branchId);
    const previousHash = await fiscalStorage.getLastDocumentHash('transport');
    const documentNumber = fiscalStorage.generateTransportDocNumber(branchCode);

    const doc: TransportDocument = {
      id: `gt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentNumber,
      branchId,
      branchName: branch?.name || '',
      type,
      originAddress,
      originCity,
      destinationAddress,
      destinationCity,
      destinationNif: options?.destinationNif,
      destinationName: options?.destinationName,
      transporterName: options?.transporterName,
      transporterNif: options?.transporterNif,
      vehiclePlate: options?.vehiclePlate,
      loadingDate,
      loadingTime,
      items,
      totalWeight: options?.totalWeight,
      totalVolume: options?.totalVolume,
      status: 'issued',
      relatedInvoiceId: options?.relatedInvoiceId,
      relatedInvoiceNumber: options?.relatedInvoiceNumber,
      notes: options?.notes,
      issuedBy,
      issuedAt: new Date().toISOString(),
      saftHash: fiscalStorage.generateDocumentHash(
        previousHash,
        loadingDate,
        documentNumber,
        items.reduce((sum, i) => sum + i.quantity, 0)
      ),
      createdAt: new Date().toISOString(),
    };

    fiscalStorage.saveTransportDocument(doc);
    refreshTransportDocs();
    return doc;
  }, [refreshTransportDocs]);

  const updateTransportStatus = useCallback((
    docId: string, 
    status: TransportDocument['status']
  ) => {
    const docs = fiscalStorage.getTransportDocuments();
    const doc = docs.find(d => d.id === docId);
    if (doc) {
      doc.status = status;
      if (status === 'delivered') {
        doc.deliveredAt = new Date().toISOString();
      }
      fiscalStorage.saveTransportDocument(doc);
      refreshTransportDocs();
    }
  }, [refreshTransportDocs]);

  return { transportDocs, createTransportDocument, updateTransportStatus, refreshTransportDocs };
}

// ==================== COMPANY INFO ====================

export function useCompanyInfo() {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(fiscalStorage.getCompanyInfo());

  const saveCompanyInfo = useCallback((info: CompanyInfo) => {
    fiscalStorage.saveCompanyInfo(info);
    setCompanyInfo(info);
  }, []);

  return { companyInfo, saveCompanyInfo };
}

// ==================== SAF-T EXPORT ====================

export function useSAFTExport() {
  const [exports, setExports] = useState<SAFTExport[]>([]);

  const refreshExports = useCallback(() => {
    setExports(fiscalStorage.getSAFTExports());
  }, []);

  useEffect(() => {
    refreshExports();
  }, [refreshExports]);

  const generateSAFT = useCallback(async (
    periodStart: string,
    periodEnd: string,
    exportedBy: string,
    branchId?: string
  ): Promise<SAFTExport> => {
    let branches: any[] = [];
    try {
      const response = await api.branches.list();
      branches = response.data || [];
    } catch {
      const raw = localStorage.getItem('kwanzaerp_branches');
      branches = raw ? JSON.parse(raw) : [];
    }
    const branch = branchId ? branches.find((b: any) => b.id === branchId) : null;
    const xml = await fiscalStorage.generateSAFTXML(periodStart, periodEnd, branchId);
    const fileName = `SAFT_AO_${periodStart.replace(/-/g, '')}_${periodEnd.replace(/-/g, '')}.xml`;

    // Get sales from API
    let allSales: Sale[] = [];
    try {
      const response = await api.sales.list();
      allSales = response.data || [];
    } catch {
      const raw = localStorage.getItem('kwanzaerp_sales');
      allSales = raw ? JSON.parse(raw) : [];
    }

    const saftExport: SAFTExport = {
      id: `saft_${Date.now()}`,
      branchId: branchId || 'all',
      branchName: branch?.name || 'Todas as Filiais',
      periodStart,
      periodEnd,
      exportType: 'custom',
      company: fiscalStorage.getCompanyInfo(),
      invoices: allSales.filter(s => {
        const date = s.createdAt.split('T')[0];
        return date >= periodStart && date <= periodEnd;
      }),
      creditNotes: fiscalStorage.getCreditNotes(branchId),
      debitNotes: fiscalStorage.getDebitNotes(branchId),
      transportDocs: fiscalStorage.getTransportDocuments(branchId),
      products: [],
      clients: [],
      exportedBy,
      exportedAt: new Date().toISOString(),
      fileName,
      xmlContent: xml,
    };

    fiscalStorage.saveSAFTExport(saftExport);
    fiscalStorage.downloadSAFTFile(xml, fileName);
    refreshExports();
    return saftExport;
  }, [refreshExports]);

  return { exports, generateSAFT, refreshExports };
}
