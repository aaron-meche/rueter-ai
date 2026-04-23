import type { CliScope, CommandDefinition } from "../types.js"
import { CliError } from "../core/errors.js"
import { clearHistory, listHistory, resolveHistoryRecord } from "../core/history.js"
import { readBooleanFlag, readIntegerFlag, requirePositionalArg } from "../core/flags.js"
import { renderHeader, renderHistoryDetail, renderHistoryList, renderJson } from "../ui/render.js"
import { promptConfirm } from "../ui/prompt.js"

export const historyCommands: readonly CommandDefinition[] = [
    {
        path: ["history", "list"],
        summary: "List recent CLI runs recorded for this project.",
        description: "Shows locally recorded prompt runs so you can revisit model, orchestrator, preset, and ask executions without hunting through terminal scrollback.",
        usage: "rueter history list [--scope <local|global>] [--limit <n>] [--json]",
        options: [
            { flag: "--scope <local|global>", description: "Only list history from one scope." },
            { flag: "--limit <n>", description: "Maximum number of entries to show. Defaults to 20." },
            { flag: "--json", description: "Output history records as JSON." },
        ],
        examples: [
            "rueter history list",
            "rueter history list --limit 5",
        ],
        async run(context) {
            const scope = readOptionalScope(context.flags.scope)
            const limit = readIntegerFlag(context.flags, "limit")
            if (limit !== undefined && limit < 1) {
                throw new CliError("History limit must be a positive integer.")
            }
            const records = await listHistory(context.cwd, {
                scope,
                limit: limit ?? undefined,
            })

            if (context.flags.json === true) {
                console.log(renderJson(records))
                return 0
            }

            console.log([
                renderHeader("CLI History", scope ? `${scope} scope` : "recent local + global runs"),
                renderHistoryList(records),
            ].join("\n"))
            return 0
        },
    },
    {
        path: ["history", "show"],
        summary: "Show one CLI history entry in detail.",
        description: "Displays the stored prompt, target metadata, duration, and recorded result for a previous CLI run.",
        usage: "rueter history show <id-prefix> [--json]",
        options: [
            { flag: "--json", description: "Output the history entry as JSON." },
        ],
        examples: [
            "rueter history show 20260423120000",
        ],
        async run(context) {
            const idPrefix = requirePositionalArg(context.args, 0, "history id or id prefix")
            const record = await resolveHistoryRecord(context.cwd, idPrefix)
            if (!record) throw new CliError(`No history entry starts with "${idPrefix}".`)

            if (context.flags.json === true) {
                console.log(renderJson(record))
                return 0
            }

            console.log(renderHistoryDetail(record))
            return 0
        },
    },
    {
        path: ["history", "clear"],
        summary: "Delete recorded CLI history for one scope.",
        description: "Removes stored history JSON files. This only affects CLI history, not saved models or orchestrators.",
        usage: "rueter history clear [--scope <local|global>] [--yes] [--json]",
        options: [
            { flag: "--scope <local|global>", description: "History scope to clear. Defaults to local." },
            { flag: "--yes, -y", description: "Skip the confirmation prompt." },
            { flag: "--json", description: "Output the number of deleted entries as JSON." },
        ],
        examples: [
            "rueter history clear --yes",
            "rueter history clear --scope global --yes",
        ],
        async run(context) {
            const scope = readOptionalScope(context.flags.scope) ?? "local"

            if (readBooleanFlag(context.flags, "yes") !== true && context.interactive) {
                const confirmed = await promptConfirm(`Delete ${scope} CLI history entries?`, false)
                if (!confirmed) throw new CliError("History clear cancelled.", 130)
            }

            const deleted = await clearHistory(context.cwd, scope)

            if (context.flags.json === true) {
                console.log(renderJson({ scope, deleted }))
                return 0
            }

            console.log([
                renderHeader("CLI History Cleared", `${scope} scope`),
                `${deleted} history entr${deleted === 1 ? "y was" : "ies were"} deleted.`,
            ].join("\n"))
            return 0
        },
    },
]

function readOptionalScope(value: unknown): CliScope | undefined {
    if (value === undefined) return undefined
    if (value === "local" || value === "global") return value
    throw new CliError(`Invalid scope "${String(value)}". Use "local" or "global".`)
}
