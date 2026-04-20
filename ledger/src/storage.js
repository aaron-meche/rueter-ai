import fs from 'fs';
import os from 'os';
import path from 'path';

const DIR = path.join(os.homedir(), '.ledger');
const DATA = path.join(DIR, 'data.json');
const TMP = path.join(DIR, 'data.tmp.json');

function validateTransaction(tx) {
  if (tx == null || typeof tx !== 'object') {
    throw new Error('Invalid transaction');
  }
  if (!tx.id) {
    throw new Error('Invalid transaction');
  }
  if (!tx.amount) {
    throw new Error('Invalid transaction');
  }
  if (typeof tx.category !== 'string') {
    throw new Error('Invalid transaction');
  }
  if (tx.description !== null && typeof tx.description !== 'string') {
    throw new Error('Invalid transaction');
  }
  if (typeof tx.date !== 'string') {
    throw new Error('Invalid transaction');
  }
  if (typeof tx.createdAt !== 'string') {
    throw new Error('Invalid transaction');
  }
}

/**
 * Reads and validates all transactions from the data file atomically.
 */
async function readData() {
  if (!fs.existsSync(DIR) || !fs.existsSync(DATA)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(DATA, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error('Invalid data');
    }
    data.forEach(validateTransaction);
    return data;
  } catch (e) {
    console.error('Error reading data:', e.message);
    process.exit(1);
  }
}

/**
 * Writes transactions to the data file atomically with validation directory creation.
 */
async function writeData(data) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(TMP, JSON.stringify(data, null, 2));
  fs.renameSync(TMP, DATA);
}

export {
  readData,
  writeData
};