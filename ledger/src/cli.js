import { Command } from 'commander';
import { v4 as uuid } from 'uuid';
import * as utils from './utils.js';
import { readData, writeData } from './storage.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function wrapHandler(handlerFn) {
  return async (...args) => {
    try {
      await handlerFn(...args);
    } catch (error) {
      console.error('Error: ' + error.message);
      process.exit(1);
    }
  };
}

/**
 * Adds a new transaction.
 */
async function handleAdd(amountStr, category, description) {
  const amount = utils.validateAmount(amountStr);
  utils.validateCategory(category);
  const id = uuid();
  const tx = {
    id,
    amount,
    category,
    description: description || null,
    date: utils.currentDate(),
    createdAt: utils.currentTimestamp()
  };
  const data = await readData();
  data.push(tx);
  await writeData(data);
  console.log(`Transaction added: ${id}`);
}

/**
 * Lists transactions, optionally filtered by month or category.
 */
async function handleList(options) {
  const data = await readData();
  const filtered = utils.filterTransactions(data, options.month, options.category);
  const headers = ['ID', 'Date', 'Amount', 'Category', 'Description'];
  const rows = filtered.map(tx => [
    utils.shortenId(tx.id),
    utils.formatDate(tx.date),
    utils.colorAmount(tx.amount),
    tx.category,
    (tx.description || '').slice(0, 20)
  ]);
  utils.renderTable(headers, rows);
}

/**
 * Shows category summary for transactions, optionally filtered by month.
 */
async function handleSummary(options) {
  const transactions = await readData();
  const filteredTransactions = utils.filterTransactions(transactions, options.month, null);
  const groupedByCategory = utils.groupByCategory(filteredTransactions);
  const categoryData = Array.from(groupedByCategory.entries()).map(([category, stats]) => ({
    category,
    total: stats.total,
    count: stats.count
  }));
  const sortedCategoryData = utils.sortCategories(categoryData);
  const headers = ['Category', 'Total', 'Count'];
  const rows = sortedCategoryData.map(({ category, total, count }) => [
    category,
    utils.colorAmount(total),
    count
  ]);
  const grandTotal = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  rows.push(['', `Net: ${utils.colorAmount(grandTotal)}`, '']);
  utils.renderTable(headers, rows);
}

/**
 * Exports transactions to CSV, optionally to a file.
 */
async function handleExport(options) {
  const transactions = (await readData()) || [];
  const csv = utils.csvHeader() + '\n' + transactions.map(tx => utils.csvRow([tx.id, tx.date, tx.amount, tx.category, tx.description])).join('\n');
  if (options?.output) {
    writeFileSync(options.output, csv);
  } else {
    console.log(csv);
  }
}

/**
 * Creates the Commander.js program with all commands.
 */
function createProgram() {
  const program = new Command();
  program
    .name('ledger')
    .description('Personal finance tracker')
    .version('1.0.0');

  program
    .command('add <amount> <category> [description]')
    .description('Add transaction')
    .action(wrapHandler(handleAdd));

  program
    .command('list')
    .description('List transactions')
    .option('--month <YYYY-MM>')
    .option('--category <name>')
    .action(wrapHandler(handleList));

  program
    .command('summary')
    .description('Category summary')
    .option('--month <YYYY-MM>')
    .action(wrapHandler(handleSummary));

  program
    .command('export')
    .description('Export to CSV')
    .option('--output <path>')
    .action(wrapHandler(handleExport));

  return program;
}

/**
 * Runs the CLI program.
 */
async function main() {
  const program = createProgram();
  await program.parseAsync();
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}