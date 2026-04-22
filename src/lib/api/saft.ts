// SAF-T API - Angola AGT Compliance
import { Sale, CompanyInfo } from '@/types/erp';
import { getCompanyInfo } from '@/lib/fiscalDocuments';

export interface SAFTExportRequest {
  month: number;
  year: number;
  branchId?: string;
}

export interface SAFTExportResponse {
  file: string;
  total_invoices: number;
  total_sales: number;
  total_vat: number;
  company_nif: string;
  period: string;
  xml: string;
}

export interface MonthlyVATReport {
  month: number;
  year: number;
  totalSales: number;
  totalVAT: number;
  invoiceCount: number;
  validatedCount: number;
  pendingCount: number;
  byVATRate: {
    rate: number;
    base: number;
    vat: number;
  }[];
}

// GET /api/saft - Generate SAF-T XML
export function generateSAFT(request: SAFTExportRequest): SAFTExportResponse {
  const sales = JSON.parse(localStorage.getItem('kwanza_sales') || '[]') as Sale[];
  const companyInfo = getCompanyInfo();
  
  // Filter sales by month/year and optionally branch
  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.createdAt);
    const matchesMonth = saleDate.getMonth() + 1 === request.month;
    const matchesYear = saleDate.getFullYear() === request.year;
    const matchesBranch = !request.branchId || sale.branchId === request.branchId;
    return matchesMonth && matchesYear && matchesBranch;
  });
  
  const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const totalVAT = filteredSales.reduce((sum, s) => sum + s.taxAmount, 0);
  
  const period = `${request.year}-${String(request.month).padStart(2, '0')}`;
  const fileName = `saft_${String(request.month).padStart(2, '0')}_${request.year}.xml`;
  
  // Generate XML
  const xml = generateSAFTXML(filteredSales, companyInfo, period);
  
  return {
    file: fileName,
    total_invoices: filteredSales.length,
    total_sales: totalSales,
    total_vat: totalVAT,
    company_nif: companyInfo.nif,
    period,
    xml
  };
}

// Generate SAF-T XML content
function generateSAFTXML(sales: Sale[], company: CompanyInfo, period: string): string {
  const now = new Date().toISOString();
  
  // Generate invoice lines
  const invoiceLines = sales.map((sale, index) => {
    const itemLines = sale.items.map((item, itemIndex) => `
        <Line>
          <LineNumber>${itemIndex + 1}</LineNumber>
          <ProductCode>${item.productId}</ProductCode>
          <ProductDescription>${escapeXml(item.productName)}</ProductDescription>
          <Quantity>${item.quantity}</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${item.unitPrice.toFixed(2)}</UnitPrice>
          <TaxPointDate>${sale.createdAt.split('T')[0]}</TaxPointDate>
          <Description>${escapeXml(item.productName)}</Description>
          <CreditAmount>${item.subtotal.toFixed(2)}</CreditAmount>
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>AO</TaxCountryRegion>
            <TaxCode>NOR</TaxCode>
            <TaxPercentage>${item.taxRate}</TaxPercentage>
          </Tax>
        </Line>`).join('');
    
    return `
      <Invoice>
        <InvoiceNo>${sale.invoiceNumber}</InvoiceNo>
        <ATCUD>${sale.agtCode || 'PENDING'}</ATCUD>
        <DocumentStatus>
          <InvoiceStatus>${sale.status === 'completed' ? 'N' : 'A'}</InvoiceStatus>
          <InvoiceStatusDate>${sale.createdAt}</InvoiceStatusDate>
          <SourceID>${sale.cashierName}</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>${generateHash(sale)}</Hash>
        <HashControl>1</HashControl>
        <Period>${parseInt(period.split('-')[1])}</Period>
        <InvoiceDate>${sale.createdAt.split('T')[0]}</InvoiceDate>
        <InvoiceType>FT</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>${sale.cashierName}</SourceID>
        <SystemEntryDate>${sale.createdAt}</SystemEntryDate>
        <CustomerID>${sale.customerNif || 'CONSUMIDOR_FINAL'}</CustomerID>
        ${itemLines}
        <DocumentTotals>
          <TaxPayable>${sale.taxAmount.toFixed(2)}</TaxPayable>
          <NetTotal>${sale.subtotal.toFixed(2)}</NetTotal>
          <GrossTotal>${sale.total.toFixed(2)}</GrossTotal>
        </DocumentTotals>
      </Invoice>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01">
  <Header>
    <AuditFileVersion>1.01_01</AuditFileVersion>
    <CompanyID>${company.nif}</CompanyID>
    <TaxRegistrationNumber>${company.nif}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${escapeXml(company.name)}</CompanyName>
    <CompanyAddress>
      <AddressDetail>${escapeXml(company.address)}</AddressDetail>
      <City>${escapeXml(company.city)}</City>
      <Province>${escapeXml(company.province)}</Province>
      <Country>AO</Country>
    </CompanyAddress>
    <FiscalYear>${period.split('-')[0]}</FiscalYear>
    <StartDate>${period}-01</StartDate>
    <EndDate>${period}-${getLastDayOfMonth(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]))}</EndDate>
    <CurrencyCode>AOA</CurrencyCode>
    <DateCreated>${now.split('T')[0]}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>${company.nif}</ProductCompanyTaxID>
    <SoftwareCertificateNumber>0000</SoftwareCertificateNumber>
    <ProductID>Kwanza ERP</ProductID>
    <ProductVersion>1.0</ProductVersion>
  </Header>
  <MasterFiles>
    <Customer>
      <CustomerID>CONSUMIDOR_FINAL</CustomerID>
      <AccountID>DESCONHECIDO</AccountID>
      <CustomerTaxID>999999999</CustomerTaxID>
      <CompanyName>Consumidor Final</CompanyName>
      <BillingAddress>
        <AddressDetail>Angola</AddressDetail>
        <City>Luanda</City>
        <Country>AO</Country>
      </BillingAddress>
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${sales.length}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${sales.reduce((sum, s) => sum + s.total, 0).toFixed(2)}</TotalCredit>
      ${invoiceLines}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;
}

// Helper: Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Helper: Get last day of month
function getLastDayOfMonth(year: number, month: number): string {
  return String(new Date(year, month, 0).getDate()).padStart(2, '0');
}

// Helper: Generate simplified hash
function generateHash(sale: Sale): string {
  const data = `${sale.createdAt}${sale.invoiceNumber}${sale.total}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

// GET /api/reports/vat - Monthly VAT Report
export function getMonthlyVATReport(month: number, year: number, branchId?: string): MonthlyVATReport {
  const sales = JSON.parse(localStorage.getItem('kwanza_sales') || '[]') as Sale[];
  
  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.createdAt);
    const matchesMonth = saleDate.getMonth() + 1 === month;
    const matchesYear = saleDate.getFullYear() === year;
    const matchesBranch = !branchId || sale.branchId === branchId;
    return matchesMonth && matchesYear && matchesBranch;
  });
  
  const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const totalVAT = filteredSales.reduce((sum, s) => sum + s.taxAmount, 0);
  const validatedCount = filteredSales.filter(s => s.agtStatus === 'validated').length;
  const pendingCount = filteredSales.filter(s => s.agtStatus !== 'validated').length;
  
  // Group by VAT rate
  const vatByRate: Record<number, { base: number; vat: number }> = {};
  filteredSales.forEach(sale => {
    sale.items.forEach(item => {
      if (!vatByRate[item.taxRate]) {
        vatByRate[item.taxRate] = { base: 0, vat: 0 };
      }
      vatByRate[item.taxRate].base += item.subtotal;
      vatByRate[item.taxRate].vat += item.taxAmount;
    });
  });
  
  return {
    month,
    year,
    totalSales,
    totalVAT,
    invoiceCount: filteredSales.length,
    validatedCount,
    pendingCount,
    byVATRate: Object.entries(vatByRate).map(([rate, data]) => ({
      rate: parseInt(rate),
      base: data.base,
      vat: data.vat
    }))
  };
}

// Download SAF-T file
export function downloadSAFT(xml: string, fileName: string): void {
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
