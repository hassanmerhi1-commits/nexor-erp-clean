import { useCompanyLogo } from '@/hooks/useCompanyLogo';
import defaultLogo from '/favicon.png?url';

interface CompanyLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  subtitle?: string;
}

export function CompanyLogo({ size = 'md', showName = true, subtitle }: CompanyLogoProps) {
  const { logo, companyName } = useCompanyLogo();

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`${sizeClasses[size]} rounded-lg bg-primary flex items-center justify-center overflow-hidden shrink-0`}>
        {logo ? (
          <img src={logo} alt={companyName} className="w-full h-full object-contain" />
        ) : (
          <img src={defaultLogo} alt="Kwanza ERP" className="w-full h-full object-contain p-1" />
        )}
      </div>
      {showName && (
        <div className="hidden sm:block">
          <h1 className="font-bold text-lg leading-none">{companyName}</h1>
          <p className="text-xs text-muted-foreground">{subtitle || 'Management System'}</p>
        </div>
      )}
    </div>
  );
}
