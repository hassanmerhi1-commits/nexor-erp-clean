// Unified Transaction API routes
// Exposes stock movements, open items, document links, and the generic transaction processor
const express = require('express');
const db = require('../db');
const { randomUUID } = require('crypto');
const { recordStockMovement, createOpenItem, linkDocuments, validatePeriod, auditLog } = require('../transactionEngine');
const { createJournalEntry } = require('../accounting');

module.exports = function(broadcastTable) {
  const router = express.Router();

  // ==================== STOCK MOVEMENTS ====================
  router.get('/stock-movements', async (req, res) => {
    try {
      const { productId, warehouseId, referenceType, limit } = req.query;
      let query = 'SELECT sm.*, p.name as product_name, p.sku FROM stock_movements sm LEFT JOIN products p ON p.id = sm.product_id WHERE 1=1';
      const params = [];
      let idx = 1;
      if (productId) { query += ` AND sm.product_id = $${idx++}`; params.push(productId); }
      if (warehouseId) { query += ` AND sm.warehouse_id = $${idx++}`; params.push(warehouseId); }
      if (referenceType) { query += ` AND sm.reference_type = $${idx++}`; params.push(referenceType); }
      query += ` ORDER BY sm.created_at DESC LIMIT $${idx++}`;
      params.push(parseInt(limit) || 500);
      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stock movements' });
    }
  });

  router.post('/stock-movements', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const movement = await recordStockMovement(client, req.body);
      await client.query('COMMIT');
      await broadcastTable('products');
      res.status(201).json(movement);
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: error.message || 'Failed to record stock movement' });
    } finally {
      client.release();
    }
  });

  // ==================== OPEN ITEMS ====================
  router.get('/open-items', async (req, res) => {
    try {
      const { entityType, entityId, status } = req.query;
      let query = 'SELECT * FROM open_items WHERE 1=1';
      const params = [];
      let idx = 1;
      if (entityType) { query += ` AND entity_type = $${idx++}`; params.push(entityType); }
      if (entityId) { query += ` AND entity_id = $${idx++}`; params.push(entityId); }
      if (status) { query += ` AND status = $${idx++}`; params.push(status); }
      else { query += ` AND status != 'cleared'`; }
      query += ' ORDER BY document_date ASC';
      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch open items' });
    }
  });

  router.post('/open-items', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const item = await createOpenItem(client, req.body);
      await client.query('COMMIT');
      res.status(201).json(item);
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: error.message || 'Failed to create open item' });
    } finally {
      client.release();
    }
  });

  // ==================== DOCUMENT LINKS ====================
  router.get('/document-links', async (req, res) => {
    try {
      const { sourceType, sourceId, targetType, targetId } = req.query;
      let query = 'SELECT * FROM document_links WHERE 1=1';
      const params = [];
      let idx = 1;
      if (sourceType && sourceId) {
        query += ` AND ((source_type = $${idx} AND source_id = $${idx + 1}) OR (target_type = $${idx} AND target_id = $${idx + 1}))`;
        params.push(sourceType, sourceId);
        idx += 2;
      }
      if (targetType && targetId) {
        query += ` AND target_type = $${idx++} AND target_id = $${idx++}`;
        params.push(targetType, targetId);
      }
      query += ' ORDER BY created_at ASC';
      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch document links' });
    }
  });

  router.post('/document-links', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const { sourceType, sourceId, sourceNumber, targetType, targetId, targetNumber } = req.body;
      const linkId = await linkDocuments(client, sourceType, sourceId, sourceNumber, targetType, targetId, targetNumber);
      await client.query('COMMIT');
      res.status(201).json({ success: true, id: linkId });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: error.message || 'Failed to link documents' });
    } finally {
      client.release();
    }
  });

  // ==================== GENERIC TRANSACTION PROCESSOR ====================
  router.post('/process', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const {
        transactionType, documentId, documentNumber, branchId,
        userId, date, description, amount, currency,
        stockEntries, journalLines, openItem, documentLinks,
        priceUpdates, entityBalanceUpdate
      } = req.body;

      // Input validation
      if (!branchId) throw new Error('branchId é obrigatório');
      if (!transactionType) throw new Error('transactionType é obrigatório');

      const result = {
        success: false,
        stockMovementIds: [],
        journalEntryId: null,
        openItemId: null,
        documentLinkIds: [],
        errors: [],
      };

      // Validate period
      await validatePeriod(client, date || new Date().toISOString());

      // Phase 1: Stock Movements (through engine)
      if (stockEntries && stockEntries.length > 0) {
        for (const entry of stockEntries) {
          const movement = await recordStockMovement(client, {
            productId: entry.productId,
            warehouseId: entry.warehouseId,
            movementType: entry.direction,
            quantity: entry.quantity,
            unitCost: entry.unitCost || 0,
            referenceType: transactionType,
            referenceId: documentId,
            referenceNumber: documentNumber,
            createdBy: userId,
          });
          result.stockMovementIds.push(movement.id);
        }
      }

      // Phase 2: Price Updates (WAC)
      if (priceUpdates && priceUpdates.length > 0) {
        for (const pu of priceUpdates) {
          const prodResult = await client.query(
            'SELECT stock, cost FROM products WHERE id = $1 FOR UPDATE',
            [pu.productId]
          );
          if (prodResult.rows.length > 0) {
            const p = prodResult.rows[0];
            const currentStock = parseInt(p.stock) || 0;
            const currentCost = parseFloat(p.cost) || 0;
            const previousStock = Math.max(currentStock - pu.quantityReceived, 0);
            const prevTotal = previousStock * currentCost;
            const newTotal = pu.quantityReceived * pu.newUnitCost;
            const totalStock = previousStock + pu.quantityReceived;
            const newAvg = totalStock > 0 ? (prevTotal + newTotal) / totalStock : pu.newUnitCost;
            await client.query('UPDATE products SET cost = $1 WHERE id = $2', [newAvg.toFixed(2), pu.productId]);
          }
        }
      }

      // Phase 3: Journal Entry (through accounting engine — validates balance)
      if (journalLines && journalLines.length > 0) {
        const entry = await createJournalEntry(client, {
          description,
          referenceType: transactionType,
          referenceId: documentId,
          branchId,
          createdBy: userId,
          lines: journalLines.map(l => ({
            accountCode: l.accountCode,
            description: l.note || description,
            debit: l.debit || 0,
            credit: l.credit || 0,
          })),
        });
        result.journalEntryId = entry.id;
      }

      // Phase 4: Open Item (through engine)
      if (openItem) {
        const oi = await createOpenItem(client, {
          entityType: openItem.entityType,
          entityId: openItem.entityId,
          documentType: openItem.documentType,
          documentId,
          documentNumber,
          documentDate: date || new Date().toISOString().split('T')[0],
          dueDate: openItem.dueDate || null,
          originalAmount: openItem.originalAmount,
          isDebit: openItem.isDebit,
          branchId,
          currency: openItem.currency || currency || 'AOA',
        });
        result.openItemId = oi.id;
      }

      // Phase 5: Document Links (through engine)
      if (documentLinks && documentLinks.length > 0) {
        for (const dl of documentLinks) {
          const linkId = await linkDocuments(client, dl.sourceType, dl.sourceId, dl.sourceNumber, dl.targetType, dl.targetId, dl.targetNumber);
          result.documentLinkIds.push(linkId);
        }
      }

      // Phase 6: Entity Balance Update
      if (entityBalanceUpdate) {
        const ebu = entityBalanceUpdate;
        if (ebu.entityType === 'supplier') {
          await client.query('UPDATE suppliers SET balance = COALESCE(balance, 0) + $1 WHERE id = $2', [ebu.amount, ebu.entityId]);
        } else if (ebu.entityType === 'customer') {
          await client.query('UPDATE clients SET current_balance = COALESCE(current_balance, 0) + $1 WHERE id = $2', [ebu.amount, ebu.entityId]);
        }
      }

      await client.query('COMMIT');

      result.success = true;
      console.log(`[TX API] ${transactionType} ${documentNumber}: stock=${result.stockMovementIds.length}, journal=${!!result.journalEntryId}, openItem=${!!result.openItemId} ✓`);

      await broadcastTable('products');
      res.status(201).json(result);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[TX API ERROR]', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Transaction failed',
        errors: [error.message],
        stockMovementIds: [],
        documentLinkIds: [],
      });
    } finally {
      client.release();
    }
  });

  return router;
};
