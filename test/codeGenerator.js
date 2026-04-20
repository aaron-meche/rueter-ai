//
// test/CodeGenerator.js
//
// Rueter AI Sandbox
// created by Aaron Meche
//
// Tests the CodeProjectGenerator workflow end-to-end.
// Run: node test/CodeGenerator.js
//

import "dotenv/config"
import { CodeProjectGenerator } from "rueter-ai"

const PROJECT_PROMPT = `
Build a command-line personal finance tracker called "Ledger" using Node.js and ES Modules.

The tool allows users to log income and expenses from the terminal, then generate
spending summaries broken down by category and time period. All data is persisted
to a local JSON file (~/.ledger/data.json).

Core commands:
  ledger add <amount> <category> [description]  — record a transaction (positive = income, negative = expense)
  ledger list [--month YYYY-MM] [--category X]  — display transactions, optionally filtered
  ledger summary [--month YYYY-MM]              — show totals per category and net balance
  ledger export [--output path.csv]             — export transactions to CSV

Requirements:
  - Commander.js for CLI argument parsing
  - Persistent JSON storage at ~/.ledger/data.json with atomic writes (write to .tmp then rename)
  - Transactions have: id (uuid), amount, category, description, date (ISO 8601), createdAt
  - Summary table rendered with aligned columns in the terminal (no external table library)
  - CSV export with headers: id, date, amount, category, description
  - Graceful error messages for invalid input (non-numeric amount, missing file, etc.)
  - A comprehensive Jest test suite covering storage, filtering, formatting, and CSV export
`

await CodeProjectGenerator({
    apiKey:        process.env.GROK_API,
    projectPrompt: PROJECT_PROMPT,
    outputDir:     "./ledger",
    projectMdPath: "./LedgerProject.md",
    onProgress(message) {
        console.log(message)
    },
})
