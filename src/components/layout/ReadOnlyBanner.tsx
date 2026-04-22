import { useEffect, useState } from 'react';
import { Eye, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getReadOnlyStatus,
  unmountReadOnlySnapshot,
  type TravelerStatus,
} from '@/lib/api/companyFile';

/**
 * NEXOR ERP — Read-Only / Traveler Mode banner (Phase 5)
 *
 * Sticky top banner shown app-wide whenever the backend is serving a
 * mounted .nexor snapshot. Includes a one-click "Exit traveler mode"
 * button that unmounts the snapshot and re-points the app at the live DB.
 */
export function ReadOnlyBanner() {
  const [status, setStatus] = useState<TravelerStatus | null>(null);
  const [exiting, setExiting] = useState(false);

  async function refresh() {
    try {
      const s = await getReadOnlyStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, []);

  if (!status?.active) return null;

  async function handleExit() {
    setExiting(true);
    try {
      await unmountReadOnlySnapshot();
      toast.success('Live database restored');
      await refresh();
      // Reload so cached data reflects the live DB
      setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to exit traveler mode');
    } finally {
      setExiting(false);
    }
  }

  return (
    <div
      className="sticky top-0 z-50 w-full border-b border-warning/40 bg-warning/15 backdrop-blur-sm text-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="font-medium">Traveler Mode (Read-Only)</span>
          <span className="hidden sm:inline text-muted-foreground truncate">
            · viewing snapshot{' '}
            <span className="font-mono">{status.filename}</span>
            {status.mountedAt && (
              <> · mounted {new Date(status.mountedAt).toLocaleString()}</>
            )}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExit}
          disabled={exiting}
          className="border-warning/60 bg-background/40 hover:bg-background/70"
        >
          {exiting ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5 mr-1.5" />
          )}
          Exit traveler mode
        </Button>
      </div>
    </div>
  );
}
