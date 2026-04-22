

## Plan: Suppress Connection Error Toasts and Stop Unnecessary Polling in Preview

### Problem
The app constantly polls `http://localhost:3000/api/health` every 15 seconds (ServerConnectionIndicator) and every 30 seconds (useDatabaseStatus), even when running in the Lovable web preview where no backend exists. This causes annoying "connect ECONNREFUSED 127.0.0.1:3000" toast notifications.

### Changes

**1. Guard health polling against web preview mode**

In `src/components/layout/ServerConnectionIndicator.tsx`:
- Only start the 15-second health check interval if running in Electron mode OR if the user has explicitly configured a server URL (setup complete). In the Lovable preview (no Electron, no setup), skip polling entirely.

In `src/hooks/useDatabaseStatus.ts`:
- Same guard: skip the 30-second polling if no setup is configured and not in Electron.

**2. Suppress raw error toasts from connection failures**

In `src/components/settings/HotUpdateSettingsCard.tsx`:
- Change `toast.error(result?.error || 'Server is offline')` to only show when the user explicitly clicks the check button (already the case), but make the error message user-friendly instead of showing raw ECONNREFUSED strings.

**3. Add a web preview detection utility**

In `src/lib/api/config.ts`:
- Add a `isWebPreview()` function that returns `true` when the app is not in Electron mode and no server has been configured. Use this to disable background network polling.

### Technical Details
- `ServerConnectionIndicator`: wrap the `setInterval` in a condition — only poll if `isElectron` or `localStorage.getItem('kwanza_setup_complete') === 'true'`
- `useDatabaseStatus`: same guard before starting the interval
- `HotUpdateSettingsCard`: sanitize error messages — replace raw network errors with "Servidor não acessível"

### Result
- No more ECONNREFUSED toasts in the preview or when server is not running
- Health checks only run when the app is actually configured to connect to a server
- Hot Update settings show clean error messages

