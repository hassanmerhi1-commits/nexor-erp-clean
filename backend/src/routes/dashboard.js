// Dashboard KPIs API Route
// Pulls real-time data from transaction engine views
const express = require('express');
const db = require('../db');

module.exports = function(broadcastTable) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { branchId } = req.query;
      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.slice(0, 7) + '-01';
      const branchFilter = branchId ? ` AND branch_id = '${branchId}'` : '';

      // Run all queries in parallel
      const [
        todaySales,
        monthSales,
        openAR,
        openAP,
        lowStock,
        pendingApprovals,
        recentMovements,
        monthExpenses,
      ] = await Promise.all([
        // Today's sales
        db.query(
          `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
           FROM sales WHERE created_at::date = $1 ${branchFilter}`,
          [today]
        ),
        // Month sales
        db.query(
          `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total 
           FROM sales WHERE created_at >= $1 ${branchFilter}`,
          [monthStart]
        ),
        // Open AR (customers owe us)
        db.query(
          `SELECT COALESCE(SUM(remaining_amount), 0) as total, COUNT(*) as count
           FROM open_items WHERE entity_type = 'customer' AND status != 'cleared' AND is_debit = true`
        ).catch(() => ({ rows: [{ total: 0, count: 0 }] })),
        // Open AP (we owe suppliers)
        db.query(
          `SELECT COALESCE(SUM(remaining_amount), 0) as total, COUNT(*) as count
           FROM open_items WHERE entity_type = 'supplier' AND status != 'cleared' AND is_debit = true`
        ).catch(() => ({ rows: [{ total: 0, count: 0 }] })),
        // Low stock products (below 10)
        db.query(
          `SELECT COUNT(*) as count FROM products WHERE stock <= 10 AND is_active = true ${branchFilter}`
        ),
        // Pending approvals
        db.query(
          `SELECT COUNT(*) as count FROM approval_requests WHERE status = 'pending'`
        ).catch(() => ({ rows: [{ count: 0 }] })),
        // Recent stock movements (last 5)
        db.query(
          `SELECT sm.*, p.name as product_name 
           FROM stock_movements sm 
           LEFT JOIN products p ON p.id = sm.product_id
           ORDER BY sm.created_at DESC LIMIT 5`
        ).catch(() => ({ rows: [] })),
        // Month expenses (from journal entries with expense accounts)
        db.query(
          `SELECT COALESCE(SUM(jel.debit), 0) as total
           FROM journal_entry_lines jel
           JOIN journal_entries je ON je.id = jel.entry_id
           WHERE je.entry_date >= $1 AND jel.account_code LIKE '6%'`,
          [monthStart]
        ).catch(() => ({ rows: [{ total: 0 }] })),
      ]);

      res.json({
        todaySales: { count: parseInt(todaySales.rows[0].count), total: parseFloat(todaySales.rows[0].total) },
        monthSales: { count: parseInt(monthSales.rows[0].count), total: parseFloat(monthSales.rows[0].total) },
        openAR: { count: parseInt(openAR.rows[0].count), total: parseFloat(openAR.rows[0].total) },
        openAP: { count: parseInt(openAP.rows[0].count), total: parseFloat(openAP.rows[0].total) },
        lowStockCount: parseInt(lowStock.rows[0].count),
        pendingApprovals: parseInt(pendingApprovals.rows[0].count),
        recentMovements: recentMovements.rows,
        monthExpenses: parseFloat(monthExpenses.rows[0].total),
      });
    } catch (error) {
      console.error('[DASHBOARD ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch dashboard KPIs' });
    }
  });

  return router;
};
