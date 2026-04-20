/ **
 * Pads a string to the specified width with trailing spaces.
 */
function pad(str, width) {
  const inputStr = String(str ?? '');
  return inputStr.padEnd(width, ' ');
}

/**
 * Shortens an ID string to first 6 characters followed by '..', or '......' if empty.
 */
function shortenId(id) {
  const str = String(id || '');
  if (str.length === 0) {
    return '......';
  }
  return str.slice(0, 6) + '..';
}

/**
 * Formats an ISO date string to YYYY-MM-DD.
 */
function formatDate(iso) {
  return (iso || '').slice(0, 10);
}

/**
 * Returns the current date as YYYY-MM-DD string.
 */
function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns the current ISO timestamp string.
 */
function currentTimestamp() {
  return new Date().toISOString();
}

/**
 * Validates a YYYY-MM month string.
 */
function parseMonth(str) {
  if (/^\d{4}-\d{2}$/.test(str)) return str;
  throw new Error('Invalid month YYYY-MM');
}

/**
 * Formats and colors an amount with ANSI codes: green for positive, red for negative.
 */
function colorAmount(amount) {
  let num = Number(amount);
  if (isNaN(num)) {
    num = 0;
  }
  const absNum = Math.abs(num);
  const formatted = absNum.toFixed(2);
  if (num > 0) {
    return '\x1b[32m+$' + formatted + '\x1b[0m';
  } else {
    return '\x1b[31m-$' + formatted + '\x1b[0m';
  }
}

/**
 * Formats an array of up to 5 fields into padded strings for table display.
 */
function formatRow(fields) {
  if (!fields || !Array.isArray(fields)) return [];
  const WIDTHS = [8, 11, 9, 10, 20];
  return fields.slice(0, 5).map((f, i) => pad(String(f || ''), WIDTHS[i]));
}

/**
 * Returns the CSV header string for transactions.
 */
function csvHeader() {
  return 'id,date,amount,category,description';
}

/**
 * Converts an array of fields to a properly quoted CSV row string.
 */
function csvRow(fields) {
  if (!fields || !Array.isArray(fields)) {
    return '""';
  }
  const escaped = fields.map(f => f ? String(f).replace(/"/g, '""') : '');
  return '"' + escaped.join('","') + '"';
}

/**
 * Validates and parses a non-zero numeric amount string.
 */
function validateAmount(str) {
  const num = parseFloat(str);
  if (isNaN(num) || num === 0) {
    throw new Error('Amount must be non-zero number');
  }
  return num;
}

/**
 * Validates and trims a non-empty category string.
 */
function validateCategory(str) {
  if (!str || !str.trim()) {
    throw new Error('Category required');
  }
  return str.trim();
}

/**
 * Filters transactions by optional month (YYYY-MM) and category, sorts by date and createdAt descending.
 */
function filterTransactions(txs, month, category) {
  if (!txs || !Array.isArray(txs)) return [];

  return txs
    .filter((tx) => {
      if (!tx || typeof tx.date !== 'string' || tx.date.length < 7) return false;
      const txMonth = tx.date.slice(0, 7);
      const monthMatch = !month || txMonth === month;
      const categoryMatch = !category || tx.category === category;
      return monthMatch && categoryMatch;
    })
    .sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
}

/**
 * Groups transactions by category, returning a Map of category to {total, count}.
 */
function groupByCategory(txs) {
  if (!txs?.length) {
    return new Map();
  }
  return txs.reduce((map, tx) => {
    const cat = tx.category;
    let sum = map.get(cat);
    if (!sum) {
      sum = {total: 0, count: 0};
      map.set(cat, sum);
    }
    sum.total += tx.amount;
    sum.count++;
    return map;
  }, new Map());
}

/**
 * Sorts an array of category summary objects by total descending.
 */
function sortCategories(cats) {
  if (!cats || !Array.isArray(cats)) {
    return [];
  }
  return [...cats].sort((a, b) => b.total - a.total);
}

/**
 * Renders a markdown-style table to console using header array and row arrays.
 */
function renderTable(headers, rows) {
  if (!headers || !Array.isArray(headers)) return;
  const cols = headers.length;
  console.log(headers.join('|'));
  console.log(Array(cols).fill('---').join('|'));
  if (rows && Array.isArray(rows)) {
    rows.forEach(row => console.log(row.join('|')))
  }
}

export {
  pad,
  colorAmount,
  formatDate,
  shortenId,
  currentDate,
  currentTimestamp,
  csvHeader,
  csvRow,
  formatRow,
  validateAmount,
  validateCategory,
  parseMonth,
  filterTransactions,
  groupByCategory,
  sortCategories,
  renderTable
};