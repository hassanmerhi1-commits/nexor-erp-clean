// Kwanza ERP - Main Server (THE HEART)
// This runs on your main PC and all other computers connect to it

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
// cors replaced by lanCors in middleware/security.js
const os = require('os');
const db = require('./db');
const { DiscoveryBroadcaster } = require('./discovery');

const app = express();
const server = http.createServer(app);

// Server discovery broadcaster
const PORT = process.env.PORT || 3000;
const discoveryBroadcaster = new DiscoveryBroadcaster(PORT, {
  name: process.env.SERVER_NAME || 'Kwanza ERP Server',
  version: '1.0.0',
  branch: process.env.BRANCH_NAME || null
});

// Socket.io for real-time sync
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins on local network
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Phase 3: LAN Security Middleware
const { lanCors, securityHeaders, rateLimiter } = require('./middleware/security');

app.use(lanCors);
app.use(securityHeaders);
app.use(rateLimiter(60000, 300)); // 300 requests/min per IP
app.use(express.json({ limit: '10mb' }));

// ============================================
// HOT UPDATE: SERVE WEBAPP FILES
// ============================================
// The webapp folder contains the built frontend files
// To update all clients, just replace files in this folder
const webappPath = path.join(__dirname, '../webapp');
const fs = require('fs');

// Check if webapp folder exists, create if not
if (!fs.existsSync(webappPath)) {
  fs.mkdirSync(webappPath, { recursive: true });
  console.log('[WEBAPP] Created webapp folder at:', webappPath);
}

// Serve static files from webapp folder
app.use('/app', express.static(webappPath));

// Serve index.html for SPA routing (any /app/* route)
app.get('/app/*', (req, res) => {
  const indexPath = path.join(webappPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ 
      error: 'Webapp not deployed',
      message: 'Place built files in backend/webapp folder'
    });
  }
});

// Redirect root-level SPA routes to the deployed webapp base path.
app.get(/^\/(?!api(?:\/|$)|app(?:\/|$)).*/, (req, res, next) => {
  const acceptsHtml = req.accepts(['html', 'json']) === 'html';
  if (!acceptsHtml) return next();

  const target = `/app${req.originalUrl === '/' ? '' : req.originalUrl}`;
  return res.redirect(302, target);
});

// Webapp version endpoint
app.get('/api/webapp-version', (req, res) => {
  const versionPath = path.join(webappPath, 'version.json');
  if (fs.existsSync(versionPath)) {
    try {
      const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      res.json(version);
    } catch (e) {
      res.json({ version: 'unknown', error: e.message });
    }
  } else {
    res.json({ version: 'not-deployed' });
  }
});

// ============================================
// REAL-TIME SYNC LOGIC
// ============================================

// Broadcast full table to ALL connected clients
async function broadcastTable(tableName) {
  try {
    const result = await db.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);
    io.emit('table_sync', { table: tableName, data: result.rows });
    console.log(`[SYNC] Broadcast ${tableName}: ${result.rows.length} rows`);
  } catch (error) {
    console.error(`[SYNC ERROR] ${tableName}:`, error.message);
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[CONNECTED] Client: ${socket.id}`);
  discoveryBroadcaster.setConnectedClients(io.sockets.sockets.size);
  
  // Send current state of all tables when client connects
  socket.on('request_sync', async () => {
    console.log(`[SYNC REQUEST] from ${socket.id}`);
    await broadcastTable('branches');
    await broadcastTable('products');
    await broadcastTable('sales');
    await broadcastTable('users');
    await broadcastTable('clients');
    await broadcastTable('categories');
    await broadcastTable('suppliers');
    await broadcastTable('daily_reports');
    await broadcastTable('stock_transfers');
    await broadcastTable('purchase_orders');
  });

  // Subscribe to specific table changes
  socket.on('subscribe', (tables) => {
    if (Array.isArray(tables)) {
      tables.forEach(t => socket.join(`table:${t}`));
      console.log(`[SUBSCRIBE] ${socket.id} → ${tables.join(', ')}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[DISCONNECTED] Client: ${socket.id}`);
    discoveryBroadcaster.setConnectedClients(io.sockets.sockets.size);
  });
});

// Enhanced broadcast: also emit targeted events for real-time listeners
const _origBroadcast = broadcastTable;
async function enhancedBroadcast(tableName) {
  await _origBroadcast(tableName);
  io.to(`table:${tableName}`).emit('table_updated', { table: tableName, timestamp: Date.now() });
}

// Transaction event broadcasting (called by transaction engine)
function broadcastTransactionEvent(eventType, data) {
  io.emit('transaction_event', { type: eventType, data, timestamp: Date.now() });
  console.log(`[TX EVENT] ${eventType}`);
}

// ============================================
// API ROUTES
// ============================================

// Import routes
const authRoutes = require('./routes/auth');
const agtRoutes = require('./routes/agt');
const branchRoutes = require('./routes/branches');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const taxRoutes = require('./routes/tax');
const clientRoutes = require('./routes/clients');
const categoryRoutes = require('./routes/categories');
const supplierRoutes = require('./routes/suppliers');
const dailyReportRoutes = require('./routes/dailyReports');
const stockTransferRoutes = require('./routes/stockTransfers');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const chartOfAccountsRoutes = require('./routes/chartOfAccounts');
const journalEntryRoutes = require('./routes/journalEntries');
const paymentRoutes = require('./routes/payments');
const auditRoutes = require('./routes/audit');
const budgetRoutes = require('./routes/budgets');
const approvalRoutes = require('./routes/approvals');
const saftRoutes = require('./routes/saft');
const dashboardRoutes = require('./routes/dashboard');
const exchangeRateRoutes = require('./routes/exchangeRates');
const saftXmlRoutes = require('./routes/saftXml');
const transactionRoutes = require('./routes/transactions');
const backupRoutes = require('./routes/backup');
const purchaseInvoiceRoutes = require('./routes/purchaseInvoices');
const erpDocumentRoutes = require('./routes/erpDocuments');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/agt', agtRoutes(broadcastTable));
app.use('/api/branches', branchRoutes(broadcastTable));
app.use('/api/products', productRoutes(broadcastTable));
app.use('/api/sales', salesRoutes(broadcastTable));
app.use('/api/clients', clientRoutes(broadcastTable));
app.use('/api/categories', categoryRoutes(broadcastTable));
app.use('/api/suppliers', supplierRoutes(broadcastTable));
app.use('/api/daily-reports', dailyReportRoutes(broadcastTable));
app.use('/api/stock-transfers', stockTransferRoutes(broadcastTable));
app.use('/api/purchase-orders', purchaseOrderRoutes(broadcastTable));
app.use('/api/chart-of-accounts', chartOfAccountsRoutes(broadcastTable));
app.use('/api/journal-entries', journalEntryRoutes(broadcastTable));
app.use('/api/payments', paymentRoutes(broadcastTable));
app.use('/api/tax', taxRoutes(broadcastTable));
app.use('/api/audit', auditRoutes(broadcastTable));
app.use('/api/budgets', budgetRoutes(broadcastTable));
app.use('/api/approvals', approvalRoutes(broadcastTable));
app.use('/api/saft', saftRoutes(broadcastTable));
app.use('/api/dashboard', dashboardRoutes(broadcastTable));
app.use('/api/exchange-rates', exchangeRateRoutes(broadcastTable));
app.use('/api/saft-xml', saftXmlRoutes(broadcastTable));
app.use('/api/transactions', transactionRoutes(broadcastTable));
app.use('/api/backup', backupRoutes(broadcastTable));
app.use('/api/purchase-invoices', purchaseInvoiceRoutes(broadcastTable));
app.use('/api/erp-documents', erpDocumentRoutes(broadcastTable));

// Health check with extended info + DB connectivity
app.get('/api/health', async (req, res) => {
  let dbConnected = false;
  let dbLatency = null;
  let dbVersion = null;
  let dockerInfo = null;

  try {
    const start = Date.now();
    const result = await db.query('SELECT version() as pg_version, NOW() as server_time, current_database() as db_name, inet_server_addr() as server_addr, inet_server_port() as server_port');
    dbLatency = Date.now() - start;
    dbConnected = true;
    const row = result.rows[0];
    dbVersion = row.pg_version;
    dockerInfo = {
      database: row.db_name,
      serverAddr: row.server_addr,
      serverPort: row.server_port,
      serverTime: row.server_time,
    };
  } catch (err) {
    console.error('[Health] DB check failed:', err.message);
  }

  res.json({ 
    status: dbConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    serverName: process.env.SERVER_NAME || 'Kwanza ERP Server',
    version: '1.0.0',
    connectedClients: io.sockets.sockets.size,
    database: {
      connected: dbConnected,
      latency: dbLatency,
      version: dbVersion,
      ...dockerInfo,
    },
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
    }
  });
});

// Server info endpoint for discovery verification
app.get('/api/server-info', (req, res) => {
  const localIPs = discoveryBroadcaster.getLocalIPs();
  res.json({
    name: process.env.SERVER_NAME || 'Kwanza ERP Server',
    version: '1.0.0',
    port: PORT,
    hostname: os.hostname(),
    platform: os.platform(),
    connectedClients: io.sockets.sockets.size,
    localIPs,
    uptime: process.uptime()
  });
});

// ============================================
// START SERVER
// ============================================

server.listen(PORT, '0.0.0.0', async () => {
  const localIPs = discoveryBroadcaster.getLocalIPs();
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           KWANZA ERP SERVER - THE HEART 💓                    ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║  Server running on port ${PORT}                                  ║`);
  console.log('║                                                               ║');
  console.log('║  Local IP addresses:                                          ║');
  localIPs.forEach(ip => {
    const line = `║    ${ip.name}: http://${ip.address}:${PORT}`;
    console.log(line.padEnd(64) + '║');
  });
  console.log('║                                                               ║');
  console.log('║  Auto-discovery: ENABLED (clients will find this server)      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Start discovery broadcaster
  try {
    await discoveryBroadcaster.start();
  } catch (error) {
    console.error('[Discovery] Failed to start broadcaster:', error.message);
  }

  // Backfill missing Caixa sub-accounts for existing branches
  try {
    const branches = await db.query('SELECT id, name FROM branches');
    if (branches.rows.length > 0) {
      const parent = await db.query(
        `SELECT id FROM chart_of_accounts WHERE code = '4.1' AND is_active = true LIMIT 1`
      );
      if (parent.rows.length > 0) {
        for (const branch of branches.rows) {
          const existing = await db.query(
            `SELECT code FROM chart_of_accounts WHERE code LIKE '4.1.%' AND level = 3 AND is_header = false
             AND (branch_id = $1 OR name LIKE '%' || $2 || '%')`,
            [branch.id, branch.name]
          );
          if (existing.rows.length === 0) {
            const seqResult = await db.query(
              `SELECT COUNT(*) as count FROM chart_of_accounts WHERE code LIKE '4.1.%' AND level = 3 AND is_header = false`
            );
            const nextSeq = parseInt(seqResult.rows[0].count) + 1;
            const code = `4.1.${nextSeq}`;
            await db.query(
              `INSERT INTO chart_of_accounts
               (code, name, description, account_type, account_nature, parent_id, level, is_header, opening_balance, current_balance, branch_id)
               VALUES ($1, $2, $3, 'asset', 'debit', $4, 3, false, 0, 0, $5)
               ON CONFLICT (code) DO NOTHING`,
              [code, `Caixa - ${branch.name}`, `Conta caixa da filial ${branch.name}`, parent.rows[0].id, branch.id]
            );
            console.log(`[STARTUP] Created missing sub-account ${code} — Caixa - ${branch.name}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[STARTUP] Backfill Caixa accounts error:', err.message);
  }
});
