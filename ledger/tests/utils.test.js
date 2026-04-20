import {
  colorAmount,
  validateAmount,
  filterTransactions,
  groupByCategory,
  csvRow,
  truncateDescription,
  sortTransactions
} from '../src/utils.js';

/**
 * Creates sample transactions with IDs for testing purposes.
 */
function createSampleTransactions() {
  return [
    {
      id: 'tx1',
      date: '2023-10-01',
      description: 'Monthly salary payment for October work from ABC Company via direct deposit into bank account.',
      amount: 5000,
      category: 'Salary',
      createdAt: '2023-10-02T10:00:00.000Z'
    },
    {
      id: 'tx2',
      date: '2023-10-15',
      description: 'Groceries at Supermarket XYZ - milk, bread, eggs, fruits, vegetables, snacks for the week.',
      amount: -75.50,
      category: 'Groceries',
      createdAt: '2023-10-16T12:00:00.000Z'
    },
    {
      id: 'tx3',
      date: '2023-10-20',
      description