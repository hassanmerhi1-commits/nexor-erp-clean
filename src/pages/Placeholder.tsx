import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

const titles: Record<string, string> = {
  '/accounting': 'Contabilidade',
  '/customers': 'Clientes',
  '/branches': 'Filiais',
  '/reports': 'Relatórios',
  '/settings': 'Configurações',
};

export default function Placeholder() {
  const location = useLocation();
  const title = titles[location.pathname] || 'Página';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{title}</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Construction className="w-16 h-16 mb-4 opacity-30" />
          <h2 className="text-xl font-semibold mb-2">Em Desenvolvimento</h2>
          <p>Este módulo será implementado em breve.</p>
        </CardContent>
      </Card>
    </div>
  );
}
