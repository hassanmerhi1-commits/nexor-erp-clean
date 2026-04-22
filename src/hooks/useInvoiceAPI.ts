import { useState, useCallback } from 'react';
import { 
  createInvoice, 
  sendToAGT, 
  getAGTStatus,
  validateNIF,
  CreateInvoiceRequest,
  CreateInvoiceResponse,
  AGTValidationResponse
} from '@/lib/api/invoices';
import { 
  generateSAFT, 
  getMonthlyVATReport, 
  downloadSAFT,
  SAFTExportResponse,
  MonthlyVATReport
} from '@/lib/api/saft';
import { toast } from 'sonner';

export function useInvoiceAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<CreateInvoiceResponse | null>(null);

  const createNewInvoice = useCallback(async (
    request: CreateInvoiceRequest,
    branchId: string,
    branchCode: string,
    userId: string
  ): Promise<CreateInvoiceResponse> => {
    setIsLoading(true);
    try {
      const response = await createInvoice(request, branchId, branchCode, userId);
      setLastResponse(response);
      
      if (response.status === 'error') {
        toast.error(response.error || 'Erro ao criar factura');
      } else {
        toast.success(`Factura ${response.invoice_number} criada com sucesso`);
      }
      
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const validateAndSendToAGT = useCallback(async (
    invoiceId: string
  ): Promise<AGTValidationResponse> => {
    setIsLoading(true);
    try {
      toast.info('A enviar para AGT...');
      const response = await sendToAGT(invoiceId);
      
      if (response.status === 'validated') {
        toast.success(`Factura validada pela AGT: ${response.agt_code}`);
      } else if (response.status === 'error') {
        toast.error(response.error || 'Erro na validação AGT');
      }
      
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkAGTStatus = useCallback((invoiceId: string) => {
    return getAGTStatus(invoiceId);
  }, []);

  const validateNIFNumber = useCallback((nif: string) => {
    return validateNIF(nif);
  }, []);

  return {
    isLoading,
    lastResponse,
    createNewInvoice,
    validateAndSendToAGT,
    checkAGTStatus,
    validateNIFNumber
  };
}

export function useSAFTAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastExport, setLastExport] = useState<SAFTExportResponse | null>(null);

  const exportSAFT = useCallback((month: number, year: number, branchId?: string): SAFTExportResponse => {
    setIsLoading(true);
    try {
      const response = generateSAFT({ month, year, branchId });
      setLastExport(response);
      toast.success(`SAF-T gerado: ${response.total_invoices} facturas`);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const downloadSAFTFile = useCallback((response: SAFTExportResponse) => {
    downloadSAFT(response.xml, response.file);
    toast.success(`Ficheiro ${response.file} transferido`);
  }, []);

  const getVATReport = useCallback((month: number, year: number, branchId?: string): MonthlyVATReport => {
    return getMonthlyVATReport(month, year, branchId);
  }, []);

  return {
    isLoading,
    lastExport,
    exportSAFT,
    downloadSAFTFile,
    getVATReport
  };
}
