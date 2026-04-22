/**
 * Electron Transaction Engine — mirrors backend/src/transactionEngine.js
 * Uses pg module directly (IPC → PostgreSQL) with identical atomic logic.
 * ALL IDs are UUIDs. FOR UPDATE locks on stock. Balanced journal enforcement.
 */
const { randomUUID } = require('crypto');

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function requireParam(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Parâmetro obrigatório em falta: ${name}`);
  }
  return value;
}

async function generateSequenceNumber(client, documentType, prefix) {
  try {
    const yr = new Date().getFullYear();
    const seqResult = await client.query(
      `SELECT id, current_number FROM document_sequences WHERE document_type = $1 AND fiscal_year = $2 FOR UPDATE`,
      [documentType, yr]
    );
    if (seqResult.rows.length > 0) {
      const nextNum = parseInt(seqResult.rows[0].current_number) + 1;
      await client.query(`UPDATE document_sequences SET current_number = $1 WHERE id = $2`, [nextNum, seqResult.rows[0].id]);
      return `${prefix}-${yr}-${String(nextNum).padStart(5, '0')}`;
    }
    await client.query(
      `INSERT INTO document_sequences (id, document_type, prefix, fiscal_year, current_number)
       VALUES ($1, $2, $3, $4, 1) ON CONFLICT (document_type, fiscal_year) DO UPDATE SET current_number = document_sequences.current_number + 1`,
      [randomUUID(), documentType, prefix, yr]
    );
    return `${prefix}-${yr}-00001`;
  } catch (e) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${prefix}${today}${String(Date.now() % 10000).padStart(4, '0')}`;
  }
}

async function recordStockMovement(client, params) {
  const { productId, warehouseId, movementType, quantity, unitCost, referenceType, referenceId, referenceNumber, notes, createdBy } = params;
  requireParam(productId, 'productId');
  requireParam(warehouseId, 'warehouseId');
  const qty = Number(quantity);
  if (qty <= 0) throw new Error('Quantidade deve ser maior que zero');

  const productResult = await client.query(`SELECT id, name, stock FROM products WHERE id = $1 FOR UPDATE`, [productId]);
  if (productResult.rows.length === 0) throw new Error(`Produto não encontrado: ${productId}`);
  const product = productResult.rows[0];

  if (movementType === 'OUT') {
    const stockResult = await client.query(
      `SELECT COALESCE(SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE -quantity END), 0) AS movement_stock
       FROM stock_movements WHERE product_id = $1 AND warehouse_id = $2`, [productId, warehouseId]
    );
    const available = Math.max(parseFloat(stockResult.rows[0].movement_stock), parseFloat(product.stock || 0));
    if (available + 0.0001 < qty) {
      throw new Error(`Stock insuficiente para ${product.name}. Disponível: ${available}, Solicitado: ${qty}`);
    }
  }

  const movementId = randomUUID();
  await client.query(
    `INSERT INTO stock_movements (id, product_id, warehouse_id, movement_type, quantity, unit_cost, reference_type, reference_id, reference_number, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [movementId, productId, warehouseId, movementType, qty, unitCost || 0, referenceType, referenceId, referenceNumber || '', notes || '', createdBy]
  );

  const stockChange = movementType === 'IN' ? qty : -qty;
  await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [stockChange, productId]);

  return { id: movementId, product_id: productId, movement_type: movementType, quantity: qty };
}

async function findAccountByCode(client, code) {
  const result = await client.query('SELECT id, code, name FROM chart_of_accounts WHERE code = $1 AND is_active = true', [code]);
  return result.rows[0] || null;
}

async function createJournalEntry(client, params) {
  const { description, referenceType, referenceId, branchId, createdBy, lines, entryDate } = params;
  if (!lines || lines.length === 0) throw new Error('Journal entry must have at least one line');

  const prefixMap = { sale: 'VD', purchase: 'CP', transfer: 'TRF', expense: 'DSP', adjustment: 'AJ', receipt: 'REC', payment: 'PAG' };
  const prefix = prefixMap[referenceType] || 'JE';
  const entryNumber = await generateSequenceNumber(client, 'journal', prefix);

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry not balanced: Debit=${totalDebit.toFixed(2)}, Credit=${totalCredit.toFixed(2)}`);
  }
  if (totalDebit === 0 && totalCredit === 0) {
    throw new Error('Journal entry cannot have zero total');
  }

  const entryId = randomUUID();
  await client.query(
    `INSERT INTO journal_entries (id, entry_number, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, branch_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,CURRENT_TIMESTAMP,$9,$10)`,
    [entryId, entryNumber, entryDate || new Date().toISOString().split('T')[0], description, referenceType, referenceId, totalDebit, totalCredit, branchId, createdBy]
  );

  for (const line of lines) {
    if ((line.debit || 0) === 0 && (line.credit || 0) === 0) continue;
    const account = await findAccountByCode(client, line.accountCode);
    if (!account) throw new Error(`Conta contabilística não encontrada: ${line.accountCode}`);
    const lineId = randomUUID();
    await client.query(
      `INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, description, debit_amount, credit_amount)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [lineId, entryId, account.id, line.description || description, line.debit || 0, line.credit || 0]
    );
    const balanceChange = (line.debit || 0) - (line.credit || 0);
    await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [balanceChange, account.id]);
  }

  return { id: entryId, entry_number: entryNumber };
}

async function getEntityAccountCode(client, entityType, entityId, entityName) {
  const prefix = entityType === 'supplier' ? '3.2.' : '3.1.';
  const fallback = entityType === 'supplier' ? '3.2.1' : '3.1.1';
  if (!entityId && !entityName) return fallback;
  try {
    if (entityName) {
      const byName = await client.query(
        `SELECT code FROM chart_of_accounts WHERE code LIKE $1 AND level = 3 AND is_header = false AND is_active = true AND name = $2 LIMIT 1`,
        [prefix + '%', entityName]
      );
      if (byName.rows.length > 0) return byName.rows[0].code;
    }
    if (entityId) {
      const byNif = await client.query(
        `SELECT code FROM chart_of_accounts WHERE code LIKE $1 AND level = 3 AND is_header = false AND is_active = true AND description LIKE '%' || $2 || '%' LIMIT 1`,
        [prefix + '%', entityId]
      );
      if (byNif.rows.length > 0) return byNif.rows[0].code;
    }
  } catch (e) { /* fallback */ }
  return fallback;
}

async function createOpenItem(client, params) {
  const { entityType, entityId, documentType, documentId, documentNumber, documentDate, dueDate, originalAmount, isDebit, branchId, currency } = params;
  const oiId = randomUUID();
  await client.query(
    `INSERT INTO open_items (id, entity_type, entity_id, document_type, document_id, document_number, document_date, due_date, currency, original_amount, remaining_amount, is_debit, branch_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12)`,
    [oiId, entityType, entityId, documentType, documentId, documentNumber, documentDate, dueDate, currency || 'AOA', originalAmount, isDebit, branchId]
  );
  return { id: oiId };
}

async function auditLog(client, params) {
  const { tableName, recordId, action, userId, userName, branchId, oldValues, newValues, description } = params;
  try {
    await client.query(
      `INSERT INTO audit_log (id, table_name, record_id, action, user_id, user_name, branch_id, old_values, new_values, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [randomUUID(), tableName, recordId, action, userId, userName, branchId,
       oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null, description]
    );
  } catch (e) { console.warn('[AUDIT] Log skipped:', e.message); }
}

module.exports = {
  recordStockMovement,
  createJournalEntry,
  generateSequenceNumber,
  findAccountByCode,
  getEntityAccountCode,
  createOpenItem,
  auditLog,
  isUuid,
  randomUUID,
};
