import { useState, useEffect } from 'react';
import { getCompanySettings } from '@/lib/companySettings';

export function useCompanyLogo() {
  const [logo, setLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('Kwanza ERP');

  useEffect(() => {
    const loadSettings = () => {
      const settings = getCompanySettings();
      setLogo(settings.logo || null);
      setCompanyName(settings.tradeName || settings.name || 'Kwanza ERP');
    };
    loadSettings();
    // Listen for storage changes (when settings are saved)
    const handler = () => loadSettings();
    window.addEventListener('storage', handler);
    window.addEventListener('company-settings-updated', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('company-settings-updated', handler);
    };
  }, []);

  return { logo, companyName };
}
