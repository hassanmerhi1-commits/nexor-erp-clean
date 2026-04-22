// Products API routes — with Optimistic Locking (Phase 3)
const express = require('express');
const db = require('../db');
const { checkOptimisticLock } = require('../middleware/security');

function sanitizeUuid(value) {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ? trimmed : null;
}

module.exports = function(broadcastTable) {
  const router = express.Router();

  // Get all products
  router.get('/', async (req, res) => {
    try {
      const { branchId } = req.query;
      let query = 'SELECT * FROM products WHERE is_active = true';
      const params = [];
      
      if (branchId) {
        query += ' AND (branch_id = $1 OR branch_id IS NULL)';
        params.push(branchId);
      }
      
      query += ' ORDER BY name';
      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('[PRODUCTS ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // Create product
  router.post('/', async (req, res) => {
    try {
      const { name, sku, barcode, category, price, cost, stock, unit, taxRate, branchId, isActive } = req.body;
      
      const result = await db.query(
        `INSERT INTO products (name, sku, barcode, category, price, cost, stock, unit, tax_rate, branch_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [name, sku, barcode, category, price, cost, stock || 0, unit || 'un', taxRate || 14, sanitizeUuid(branchId), isActive !== false]
      );
      
      // Broadcast to ALL clients
      await broadcastTable('products');
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('[PRODUCTS ERROR]', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  });

  // Update product (with optimistic locking)
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, sku, barcode, category, price, cost, stock, unit, taxRate, branchId, isActive, version } = req.body;
      
      let result;
      if (version != null) {
        result = await db.query(
          `UPDATE products 
           SET name = $1, sku = $2, barcode = $3, category = $4, price = $5, cost = $6, 
               stock = $7, unit = $8, tax_rate = $9, branch_id = $10, is_active = $11,
               version = version + 1
           WHERE id = $12 AND version = $13
           RETURNING *`,
          [name, sku, barcode, category, price, cost, stock, unit, taxRate, sanitizeUuid(branchId), isActive, id, version]
        );
        if (!checkOptimisticLock(result, res, 'Product')) return;
      } else {
        result = await db.query(
          `UPDATE products 
           SET name = $1, sku = $2, barcode = $3, category = $4, price = $5, cost = $6, 
               stock = $7, unit = $8, tax_rate = $9, branch_id = $10, is_active = $11
           WHERE id = $12
           RETURNING *`,
          [name, sku, barcode, category, price, cost, stock, unit, taxRate, sanitizeUuid(branchId), isActive, id]
        );
        if (result.rowCount === 0) {
          return res.status(404).json({ error: 'Product not found' });
        }
      }
      
      await broadcastTable('products');
      res.json(result.rows[0]);
    } catch (error) {
      console.error('[PRODUCTS ERROR]', error);
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  // Update stock
  router.patch('/:id/stock', async (req, res) => {
    try {
      const { id } = req.params;
      const { quantityChange } = req.body;
      
      const result = await db.query(
        'UPDATE products SET stock = stock + $1 WHERE id = $2 RETURNING *',
        [quantityChange, id]
      );
      
      // Broadcast to ALL clients
      await broadcastTable('products');
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('[PRODUCTS ERROR]', error);
      res.status(500).json({ error: 'Failed to update stock' });
    }
  });

  // Batch import products
  router.post('/batch', async (req, res) => {
    try {
      const { products } = req.body;
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'products array is required' });
      }

      let imported = 0;
      let failed = 0;
      const errors = [];

      for (const p of products) {
        try {
          if (!p?.name || !p?.sku) {
            throw new Error('Missing required fields: name and sku');
          }

          await db.query(
            `INSERT INTO products (name, sku, barcode, category, price, cost, stock, unit, tax_rate, branch_id, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (sku, branch_id) DO UPDATE SET
               name = EXCLUDED.name, price = EXCLUDED.price, cost = EXCLUDED.cost,
               stock = EXCLUDED.stock, unit = EXCLUDED.unit, tax_rate = EXCLUDED.tax_rate,
                barcode = EXCLUDED.barcode, category = EXCLUDED.category,
                is_active = EXCLUDED.is_active
             `,
            [
              p.name, p.sku, p.barcode || '', p.category || 'GERAL',
              Number(p.price) || 0, Number(p.cost) || 0, Number(p.stock) || 0, p.unit || 'UN',
              Number(p.taxRate) || 14, sanitizeUuid(p.branchId), p.isActive !== false
            ]
          );
          imported++;
        } catch (err) {
          failed++;
          errors.push({ sku: p.sku, error: err.message });
        }
      }

      await broadcastTable('products');
      res.status(201).json({ imported, failed, errors: errors.slice(0, 20) });
    } catch (error) {
      console.error('[PRODUCTS BATCH ERROR]', error);
      res.status(500).json({ error: 'Failed to batch import products' });
    }
  });

  // Delete product (soft delete)
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      await db.query('UPDATE products SET is_active = false WHERE id = $1', [id]);
      
      // Broadcast to ALL clients
      await broadcastTable('products');
      
      res.json({ success: true });
    } catch (error) {
      console.error('[PRODUCTS ERROR]', error);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  return router;
};
