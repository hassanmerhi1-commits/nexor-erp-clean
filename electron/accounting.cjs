/**
 * Accounting Module for Electron Main Process
 * Creates double-entry journal entries directly against PostgreSQL
 * Ported from backend/src/accounting.js
 */

async function generateEntryNumber(pool, prefix = 'JE') {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM journal_entries WHERE entry_number LIKE $1`,
    [`${prefix}${today}%`]
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `${prefix}${today}${count.toString().padStart(4, '0')}`;
}

async function findAccountByCode(client, code) {
  const result = await client.query(
    'SELECT id, code, name FROM chart_of_accounts WHERE code = $1 AND is_active = true',
    [code]
  );
  return result.rows[0] || null;
}

async function createJournalEntry(client, pool, params) {
  const {
    description, referenceType, referenceId, branchId,
    createdBy, lines, entryDate
  } = params;

  const prefixMap = {
    sale: 'VD', purchase: 'CP', transfer: 'TRF',
    expense: 'DSP', adjustment: 'AJ', receipt: 'REC', payment: 'PAG',
  };
  const prefix = prefixMap[referenceType] || 'JE';
  const entryNumber = await generateEntryNumber(pool, prefix);

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry not balanced: Debit=${totalDebit}, Credit=${totalCredit}`);
  }

  const entryResult = await client.query(
    `INSERT INTO journal_entries 
     (entry_number, entry_date, description, reference_type, reference_id, 
      total_debit, total_credit, is_posted, posted_at, branch_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, $8, $9)
     RETURNING *`,
    [entryNumber, entryDate || new Date().toISOString().split('T')[0],
     description, referenceType, referenceId,
     totalDebit, totalCredit, branchId, createdBy]
  );

  const entry = entryResult.rows[0];

  for (const line of lines) {
    const account = await findAccountByCode(client, line.accountCode);
    if (!account) {
      throw new Error(`Conta contabilística não encontrada: ${line.accountCode}`);
    }

    await client.query(
      `INSERT INTO journal_entry_lines 
       (journal_entry_id, account_id, description, debit_amount, credit_amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [entry.id, account.id, line.description || description, line.debit || 0, line.credit || 0]
    );

    const balanceChange = (line.debit || 0) - (line.credit || 0);
    await client.query(
      `UPDATE chart_of_accounts SET current_balance = current_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [balanceChange, account.id]
    );
  }

  console.log(`[ACCOUNTING] Created ${entryNumber} (${referenceType}): D=${totalDebit}, C=${totalCredit}`);
  return entry;
}

module.exports = { createJournalEntry, findAccountByCode, generateEntryNumber };
