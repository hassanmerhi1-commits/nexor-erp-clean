/**
 * NEXOR ERP — Read-Only Mode Middleware
 * ----------------------------------------
 * When the server (or local Electron) is running in "Traveler Mode"
 * (i.e. backed by an imported .nexor snapshot), every state-changing
 * HTTP method is rejected with 403.
 *
 * Toggled by:
 *   process.env.NEXOR_READ_ONLY === '1'   (set by traveler bootstrap)
 *
 * Defense-in-depth: the UI also disables write controls, but this
 * guarantees no rogue request can mutate a snapshot.
 */

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Allow auth + health even in read-only mode so the user can log in
// and the status indicator keeps working.
const ALLOWED_PATHS = [
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/logout$/,
  /^\/api\/health/,
  // Traveler mode toggle paths must work even when read-only is active,
  // otherwise the user can never unmount the snapshot.
  /^\/api\/company-file\/unmount-readonly/,
  /^\/api\/company-file\/mount-readonly/,
  /^\/api\/company-file\/readonly-status/,
];

function readOnlyGuard(req, res, next) {
  if (process.env.NEXOR_READ_ONLY !== '1') return next();
  if (!MUTATING_METHODS.has(req.method)) return next();
  if (ALLOWED_PATHS.some((rx) => rx.test(req.path))) return next();

  return res.status(403).json({
    error: 'READ_ONLY_MODE',
    message:
      'This server is running on a read-only company snapshot (.nexor file). ' +
      'No changes can be saved. Connect to the live database to make changes.',
  });
}

module.exports = { readOnlyGuard };