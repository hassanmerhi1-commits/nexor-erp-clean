import { useState, useEffect } from 'react';

export function StatusBar() {
  const [now, setNow] = useState(new Date());
  const [version, setVersion] = useState('2025 R7');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);

    if (window.electronAPI?.app?.getVersion) {
      window.electronAPI.app.getVersion().then((v: string) => setVersion(v)).catch(() => {});
    }

    return () => clearInterval(timer);
  }, []);

  const formatDate = () => {
    const d = now;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
  };

  return (
    <div className="h-7 bg-sidebar text-sidebar-foreground/70 flex items-center justify-end px-3 text-[10px] font-medium select-none gap-3">
      <span className="px-2 py-0.5 rounded-full bg-sidebar-primary/20 text-sidebar-primary text-[9px] font-bold">
        ERP {version}
      </span>
      <span className="font-mono">{formatDate()}</span>
    </div>
  );
}
