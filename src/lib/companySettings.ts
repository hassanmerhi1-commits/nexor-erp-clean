/**
 * Company Settings Management for Kwanza ERP
 * Stores company information for invoices and receipts
 */

export interface CompanySettings {
  // Basic Info
  name: string;
  tradeName?: string; // Nome comercial
  nif: string;
  
  // Address
  address: string;
  city: string;
  province: string;
  postalCode?: string;
  country: string;
  
  // Contact
  phone: string;
  email?: string;
  website?: string;
  
  // Banking
  bankName?: string;
  iban?: string;
  
  // Branding
  logo?: string; // Base64 or URL
  logoWidth?: number;
  primaryColor?: string;
  
  // AGT / Fiscal
  agtCertificateNumber?: string;
  softwareVersion?: string;
  licenseNumber?: string;
  
  // Invoice Settings
  invoicePrefix?: string;
  invoiceNotes?: string;
  footerText?: string;
  
  // Exchange Rates (Câmbio)
  exchangeRateUSD?: number; // 1 USD = X AOA
  exchangeRateEUR?: number; // 1 EUR = X AOA
  exchangeRateUpdatedAt?: string;
  
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'kwanza_company_settings';

const DEFAULT_SETTINGS: CompanySettings = {
  name: 'Empresa Demo, Lda',
  tradeName: 'Kwanza ERP Demo',
  nif: '5000000000',
  address: 'Rua Comandante Gika, 123',
  city: 'Luanda',
  province: 'Luanda',
  country: 'Angola',
  phone: '+244 923 456 789',
  email: 'info@empresa.co.ao',
  website: 'www.empresa.co.ao',
  agtCertificateNumber: 'SW/AGT/2025/0001',
  softwareVersion: '1.0.0',
  invoicePrefix: 'FT',
  footerText: 'Obrigado pela preferência!',
  invoiceNotes: 'Pagamento a pronto. Não aceitamos devoluções após 7 dias.',
  primaryColor: '#2563eb',
};

export function getCompanySettings(): CompanySettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.error('Error loading company settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveCompanySettings(settings: Partial<CompanySettings>): CompanySettings {
  try {
    const current = getCompanySettings();
    const updated = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('company-settings-updated'));
    return updated;
  } catch (error) {
    console.error('Error saving company settings:', error);
    throw error;
  }
}

export function resetCompanySettings(): CompanySettings {
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_SETTINGS;
}

// Convert file to base64 for logo storage
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

// Validate NIF format (Angola uses 10-digit NIFs)
export function validateNIF(nif: string): boolean {
  const cleaned = nif.replace(/\D/g, '');
  return cleaned.length === 10;
}
