import type { CommandDefinition } from "../types.js"
import { formatProviderName, type IndexedModelInfo } from "../core/catalog.js"
import { padRight, rule, theme } from "./theme.js"

export function renderRootHelp(version: string, commands: readonly CommandDefinition[]): string {
    const rows = commands.map(command => ({
        label: command.path.join(" "),
        value: command.summary,
    }))

    return [
        renderHeader("Rueter CLI", `v${version}  |  Phase 1 scaffold`),
        "A polished terminal foundation for rueter-ai.",
        "",
        renderSubsection("Available Commands"),
        renderKeyValueRows(rows),
        "",
        renderSubsection("Examples"),
        "  rueter doctor",
        "  rueter config init",
        "  rueter config init --scope global",
        "  rueter models catalog",
        "  rueter models catalog --provider openai",
        "  rueter models catalog --interactive",
        "",
        renderSubsection("Global Flags"),
        "  --help, -h       Show help",
        "  --version, -v    Show package version",
        "",
        theme.muted("Only the foundation commands are live in this first scaffold."),
    ].join("\n")
}

export function renderCommandHelp(command: CommandDefinition): string {
    const lines = [
        renderHeader(`rueter ${command.path.join(" ")}`, command.summary),
    ]

    if (command.description) {
        lines.push(command.description)
    }

    if (command.usage) {
        lines.push("")
        lines.push(renderSubsection("Usage"))
        lines.push(`  ${command.usage}`)
    }

    if (command.options && command.options.length > 0) {
        lines.push("")
        lines.push(renderSubsection("Options"))
        lines.push(renderKeyValueRows(
            command.options.map(option => ({
                label: option.flag,
                value: option.description,
            }))
        ))
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
    return rows
        .map(row => `  ${padRight(row.label, labelWidth)}  ${row.value}`)
        .join("\n")
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
        lines.push(`    context: ${formatInteger(model.context)} | input: $${model.input_cost.toFixed(2)}/M | output: $${model.output_cost.toFixed(2)}/M`)
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
            { label: "context", value: formatInteger(model.context) },
            { label: "input", value: `$${model.input_cost.toFixed(2)} / 1M tokens` },
            { label: "output", value: `$${model.output_cost.toFixed(2)} / 1M tokens` },
        ]),
        "",
        renderSubsection("Description"),
        model.description,
    ].join("\n")
}

export function renderJson(value: unknown): string {
    return JSON.stringify(value, null, 2)
}

export function renderTip(message: string): string {
    return theme.muted(`Tip: ${message}`)
}

function formatInteger(value: number): string {
    return new Intl.NumberFormat("en-US").format(value)
}
