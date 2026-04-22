// Kwanza ERP App Layout
import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import { StatusBar } from './StatusBar';
import { useBranchContext } from '@/contexts/BranchContext';
import { useAuth } from '@/hooks/useERP';

export function AppLayout() {
  const { branches, currentBranch, setCurrentBranch } = useBranchContext();
  const { user, logout } = useAuth();

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopNav
        user={user}
        branches={branches}
        currentBranch={currentBranch}
        onBranchChange={setCurrentBranch}
        onLogout={logout}
      />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <StatusBar />
    </div>
  );
}