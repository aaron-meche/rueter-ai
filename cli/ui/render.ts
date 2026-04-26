import type {
    CommandDefinition,
    HistoryRecord,
    ModelExecutionResult,
    OrchestratorExecutionResult,
    SavedModelRecord,
    SavedOrchestratorRecord,
} from "../types.js"
import { formatProviderName, type IndexedModelInfo } from "../core/catalog.js"
import { padRight, rule, theme } from "./theme.js"

export function renderRootHelp(version: string, commands: readonly CommandDefinition[]): string {
    const grouped = groupCommands(commands)

    return [
        renderHeader("Rueter CLI", `v${version}`),
        "A production CLI for the rueter-ai package.",
        "",
        renderSubsection("Command Groups"),
        renderKeyValueRows([
            { label: "doctor", value: "Inspect runtime, config scopes, and provider readiness." },
            { label: "config", value: "Initialize and inspect CLI storage." },
            { label: "models", value: "Create, inspect, run, and manage saved RueterModel definitions." },
            { label: "orchestrators", value: "Create and run saved multi-model Rueter orchestrators." },
            { label: "ask", value: "Run one-off prompts without saving a definition first." },
            { label: "presets", value: "Run built-in specialized model factories." },
            { label: "workflows", value: "Run higher-level exported package workflows." },
            { label: "ghostwriter", value: "Rewrite text using the exported GhostWriter style helper." },
            { label: "history", value: "Inspect recent local CLI runs." },
        ]),
        "",
        ...grouped.map(([group, entries]) => [
            renderSubsection(group),
            renderKeyValueRows(entries.map(entry => ({
                label: entry.path.join(" "),
                value: entry.summary,
            }))),
            "",
        ].join("\n")),
        renderSubsection("Examples"),
        "  rueter doctor",
        "  rueter models create",
        "  rueter models run my-model --prompt \"Explain ACID transactions.\"",
        "  rueter orchestrators create",
        "  rueter ask --provider openai --model gpt-5.4 --prompt \"Summarize this file.\"",
        "  rueter presets run simple-answer --prompt \"Capital of Japan\"",
        "  rueter history list",
        "",
        renderSubsection("Global Flags"),
        "  --help, -h       Show help",
        "  --version, -v    Show package version",
        "  --json, -j       Output machine-readable JSON when supported",
        "  --no-color       Disable ANSI styling",
        "  --no-history     Do not record this run in local history",
    ].join("\n")
}

export function renderCommandHelp(command: CommandDefinition): string {
    const lines = [
        renderHeader(`rueter ${command.path.join(" ")}`, command.summary),
    ]

    if (command.description) lines.push(command.description)

    if (command.usage) {
        lines.push("")
        lines.push(renderSubsection("Usage"))
        lines.push(`  ${command.usage}`)
    }

    if (command.options && command.options.length > 0) {
        lines.push("")
        lines.push(renderSubsection("Options"))
        lines.push(renderKeyValueRows(command.options.map(option => ({
            label: option.flag,
            value: option.description,
        }))))
    }

    if (command.examples && command.examples.length > 0) {
        lines.push("")
        lines.push(renderSubsection("Examples"))
        lines.push(...command.examples.map(example => `  ${example}`))
    }

    return lines.join("\n")
}

export function renderHeader(title: string, subtitle?: string): string {
    const lines = [theme.bold(theme.accent(title))]
    if (subtitle) lines.push(theme.muted(subtitle))
    lines.push(theme.muted(rule()))
    return lines.join("\n")
}

export function renderSubsection(title: string): string {
    return `${theme.bold(title)}\n${theme.muted("-".repeat(title.length))}`
}

export function renderKeyValueRows(rows: Array<{ label: string; value: string }>): string {
    const labelWidth = Math.max(...rows.map(row => row.label.length), 0)
    return rows.map(row => `  ${padRight(row.label, labelWidth)}  ${row.value}`).join("\n")
}

export function renderBulletList(values: readonly string[]): string {
    return values.map(value => `  - ${value}`).join("\n")
}

export function renderStatus(value: boolean, successText = "ready", failureText = "missing"): string {
    return value ? theme.success(successText) : theme.warning(failureText)
}

export function renderProviderCatalog(provider: string, models: readonly IndexedModelInfo[]): string {
    const lines = [
        theme.bold(formatProviderName(provider as never)),
        theme.muted("-".repeat(formatProviderName(provider as never).length)),
    ]

    for (const model of models) {
        lines.push(`${theme.accent(`[${model.index}]`)} ${theme.bold(model.name)}`)
        lines.push(`    ${model.description}`)
        lines.push(`    ${formatModelPricing(model)}`)
        lines.push("")
    }

    while (lines[lines.length - 1] === "") lines.pop()
    return lines.join("\n")
}

export function renderModelDetail(model: IndexedModelInfo): string {
    return [
        renderHeader(`${formatProviderName(model.provider)} Model`, `[${model.index}] ${model.name}`),
        renderKeyValueRows([
            { label: "provider", value: formatProviderName(model.provider) },
            { label: "index", value: String(model.index) },
            { label: "model", value: model.name },
            { label: "input", value: model.pricing_available === false ? "n/a" : `$${model.input_cost.toFixed(2)} / 1M tokens` },
            { label: "output", value: model.pricing_available === false ? "n/a" : `$${model.output_cost.toFixed(2)} / 1M tokens` },
        ]),
        "",
        renderSubsection("Description"),
        model.description,
    ].join("\n")
}

export function renderSavedModelList(records: readonly SavedModelRecord[]): string {
    if (records.length === 0) return theme.muted("No saved models were found.")

    return records
        .map(record => {
            const provider = formatProviderName(record.definition.provider)
            return [
                `${theme.bold(record.definition.name)} ${theme.muted(`(${record.scope})`)}`,
                `  ${provider} · [${record.definition.modelIndex}] ${record.definition.modelName}`,
                `  env: ${record.definition.apiKeyEnv}`,
            ].join("\n")
        })
        .join("\n\n")
}

export function renderSavedModelDetail(record: SavedModelRecord): string {
    const configRows = buildConfigRows(record.definition.config)
    return [
        renderHeader(`Saved Model: ${record.definition.name}`, `${record.scope} scope`),
        renderKeyValueRows([
            { label: "provider", value: formatProviderName(record.definition.provider) },
            { label: "model", value: `[${record.definition.modelIndex}] ${record.definition.modelName}` },
            { label: "api env", value: record.definition.apiKeyEnv },
            { label: "file", value: record.filePath },
            { label: "updated", value: record.definition.updatedAt },
        ]),
        "",
        renderSubsection("Config"),
        configRows.length > 0 ? renderKeyValueRows(configRows) : "  No custom model config saved.",
    ].join("\n")
}

export function renderSavedOrchestratorList(records: readonly SavedOrchestratorRecord[]): string {
    if (records.length === 0) return theme.muted("No saved orchestrators were found.")

    return records
        .map(record => [
            `${theme.bold(record.definition.name)} ${theme.muted(`(${record.scope})`)}`,
            `  models: ${record.definition.models.map(model => `${model.name} [${model.scope}]`).join(", ")}`,
        ].join("\n"))
        .join("\n\n")
}

export function renderSavedOrchestratorDetail(record: SavedOrchestratorRecord): string {
    const configRows = buildConfigRows(record.definition.config)
    return [
        renderHeader(`Saved Orchestrator: ${record.definition.name}`, `${record.scope} scope`),
        renderKeyValueRows([
            { label: "models", value: String(record.definition.models.length) },
            { label: "file", value: record.filePath },
            { label: "updated", value: record.definition.updatedAt },
        ]),
        "",
        renderSubsection("Model References"),
        renderBulletList(record.definition.models.map(model => `${model.name} (${model.scope})`)),
        "",
        renderSubsection("Shared Config"),
        configRows.length > 0 ? renderKeyValueRows(configRows) : "  No shared config saved.",
    ].join("\n")
}

export function renderModelExecutionResult(execution: ModelExecutionResult): string {
    const cost = execution.result.cost
    const metadataRows = [
        { label: "name", value: execution.name },
        { label: "provider", value: formatProviderName(execution.provider) },
        { label: "model", value: execution.modelName },
        { label: "duration", value: formatDuration(execution.durationMs) },
    ]

    if (cost) metadataRows.push({ label: "cost", value: `$${cost.total} total` })

    return [
        renderHeader("Model Result", `${execution.name} · ${execution.modelName}`),
        renderKeyValueRows(metadataRows),
        "",
        renderSubsection("Response"),
        execution.result.res ?? theme.warning("No response text returned."),
        execution.result.error
            ? `\n\n${renderSubsection("Error")}\n${theme.danger(execution.result.error)}`
            : "",
        cost
            ? `\n\n${renderSubsection("Cost Breakdown")}\n${renderKeyValueRows([
                { label: "input", value: `$${cost.input}` },
                { label: "output", value: `$${cost.output}` },
                { label: "total", value: `$${cost.total}` },
            ])}`
            : "",
    ].join("")
}

export function renderOrchestratorExecutionResult(execution: OrchestratorExecutionResult): string {
    const ids = Object.keys(execution.result).sort((left, right) => left.localeCompare(right))
    const panels = ids.map(id => {
        const modelResult = execution.result[id]
        const header = `${theme.bold(id)} ${modelResult.error ? theme.danger("[error]") : theme.success("[ok]")}`
        const lines = [header]

        if (modelResult.res) lines.push(`  ${modelResult.res.replace(/\n/g, "\n  ")}`)
        if (modelResult.error) lines.push(`  ${theme.danger(modelResult.error)}`)
        if (modelResult.cost) lines.push(`  cost: $${modelResult.cost.total} total`)

        return lines.join("\n")
    })

    return [
        renderHeader("Orchestrator Result", `${execution.name} · ${formatDuration(execution.durationMs)}`),
        renderSubsection("Responses"),
        panels.join("\n\n"),
    ].join("\n")
}

export function renderHistoryList(records: readonly HistoryRecord[]): string {
    if (records.length === 0) return theme.muted("No CLI history entries were found.")

    return records
        .map(record => {
            const prompt = record.entry.prompt ? truncate(record.entry.prompt.replace(/\s+/g, " "), 96) : "No prompt recorded."
            return [
                `${theme.bold(record.entry.id)} ${theme.muted(`(${record.scope})`)}`,
                `  ${record.entry.target.type}: ${record.entry.target.name}`,
                `  created: ${record.entry.createdAt}`,
                `  prompt: ${prompt}`,
            ].join("\n")
        })
        .join("\n\n")
}

export function renderHistoryDetail(record: HistoryRecord): string {
    const entry = record.entry
    const metadataRows = [
        { label: "id", value: entry.id },
        { label: "scope", value: record.scope },
        { label: "target", value: `${entry.target.type}: ${entry.target.name}` },
        { label: "created", value: entry.createdAt },
        { label: "duration", value: entry.durationMs === undefined ? "n/a" : formatDuration(entry.durationMs) },
        { label: "file", value: record.filePath },
    ]

    if (entry.target.provider) metadataRows.push({ label: "provider", value: formatProviderName(entry.target.provider) })
    if (entry.target.modelName) metadataRows.push({ label: "model", value: entry.target.modelName })

    const lines = [
        renderHeader("History Entry", entry.id),
        renderKeyValueRows(metadataRows),
        "",
        renderSubsection("Command"),
        `  rueter ${entry.command.join(" ")}`,
        "",
        renderSubsection("Prompt"),
        entry.prompt ?? theme.muted("No prompt recorded."),
    ]

    if (entry.result !== undefined) {
        lines.push("")
        lines.push(renderSubsection("Result"))
        lines.push(renderJson(entry.result))
    }

    return lines.join("\n")
}

export function renderRawModelResult(execution: ModelExecutionResult): string {
    return execution.result.res ?? execution.result.error ?? ""
}

export function renderRawOrchestratorResult(execution: OrchestratorExecutionResult): string {
    return Object.entries(execution.result)
        .map(([id, result]) => {
            const value = result.res ?? result.error ?? ""
            return `${id}\n${value}`
        })
        .join("\n\n")
}

export function renderJson(value: unknown): string {
    return JSON.stringify(value, null, 2)
}

export function renderTip(message: string): string {
    return theme.muted(`Tip: ${message}`)
}

function buildConfigRows(config: object): Array<{ label: string; value: string }> {
    return Object.entries(config as Record<string, unknown>)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ({
            label: key,
            value: Array.isArray(value) ? value.join(", ") : String(value),
        }))
}

function formatModelPricing(model: IndexedModelInfo): string {
    if (model.pricing_available === false) return "pricing: n/a"
    return `input: $${model.input_cost.toFixed(2)}/M | output: $${model.output_cost.toFixed(2)}/M`
}

function groupCommands(commands: readonly CommandDefinition[]): Array<[string, readonly CommandDefinition[]]> {
    const groups = new Map<string, CommandDefinition[]>()
    for (const command of commands) {
        const key = command.path[0]
        const items = groups.get(key) ?? []
        items.push(command)
        groups.set(key, items)
    }

    return [...groups.entries()].map(([group, entries]) => [
        group,
        [...entries].sort((left, right) => left.path.join(" ").localeCompare(right.path.join(" "))),
    ])
}

function formatInteger(value: number): string {
    return new Intl.NumberFormat("en-US").format(value)
}

function formatDuration(value: number): string {
    if (value < 1000) return `${value.toFixed(0)}ms`
    return `${(value / 1000).toFixed(2)}s`
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value
    return `${value.slice(0, maxLength - 3)}...`
}
