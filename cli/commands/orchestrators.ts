import type { CliScope, CommandDefinition, SavedModelRef } from "../types.js"
import { CliError } from "../core/errors.js"
import { readBooleanFlag, readCsvFlag, readIntegerFlag, readNumberFlag, readStringFlag, requirePositionalArg } from "../core/flags.js"
import { resolvePromptText } from "../core/input.js"
import {
    buildModelReferenceList,
    deleteSavedOrchestrator,
    listAddressableModels,
    listSavedOrchestrators,
    resolveSavedOrchestrator,
    saveSavedOrchestrator,
} from "../core/orchestrators.js"
import { executeSavedOrchestratorPrompt } from "../core/runtime.js"
import {
    renderHeader,
    renderJson,
    renderOrchestratorExecutionResult,
    renderSavedOrchestratorDetail,
    renderSavedOrchestratorList,
    renderTip,
} from "../ui/render.js"
import { promptConfirm, promptNumber, promptText } from "../ui/prompt.js"
import { multiSelectOptions, selectOption } from "../ui/select.js"

export const orchestratorCommands: readonly CommandDefinition[] = [
    {
        path: ["orchestrators", "create"],
        summary: "Create and save a named Rueter orchestrator definition.",
        description: "Builds a reusable multi-model orchestrator from saved models. Interactive mode uses a highlighted multi-select so you can clearly choose which saved models to fan prompts across.",
        usage: "rueter orchestrators create [--name <name>] [--models <scope:name,...>] [--scope <local|global>] [--force]",
        options: [
            { flag: "--name <name>", description: "Saved orchestrator name." },
            { flag: "--models <scope:name,...>", description: "Comma-separated saved model references. Scope prefixes are optional when unambiguous." },
            { flag: "--scope <local|global>", description: "Where to save the orchestrator." },
            { flag: "--system-prompt <text>", description: "Optional shared orchestrator system prompt." },
            { flag: "--temperature <n>", description: "Optional shared temperature between 0 and 1." },
            { flag: "--max-tokens <n>", description: "Optional shared max token limit." },
            { flag: "--force", description: "Overwrite the saved definition if it already exists." },
            { flag: "--json", description: "Output the saved record as JSON." },
        ],
        examples: [
            "rueter orchestrators create",
            "rueter orchestrators create --name frontier-compare --models local:openai-main,global:claude-main",
        ],
        async run(context) {
            const scope = await resolveScope(context.flags.scope, context.interactive)
            const modelRefs = await resolveModelRefs(context)
            const name = await resolveOrchestratorName(context)
            const config = await resolveOrchestratorConfig(context)

            const record = await saveSavedOrchestrator({
                name,
                models: modelRefs,
                config,
            }, scope, context.cwd, context.flags.force === true)

            if (context.flags.json === true) {
                console.log(renderJson(record))
                return 0
            }

            console.log([
                renderHeader("Saved Orchestrator Created", `${record.definition.name} · ${record.scope} scope`),
                renderSavedOrchestratorDetail(record),
                "",
                renderTip(`Run it with: rueter orchestrators run ${record.definition.name} --prompt "Hello"`),
            ].join("\n"))
            return 0
        },
    },
    {
        path: ["orchestrators", "list"],
        summary: "List saved orchestrator definitions from local and global CLI storage.",
        description: "Shows saved orchestrators together with the saved models each one references.",
        usage: "rueter orchestrators list [--scope <local|global>] [--json]",
        options: [
            { flag: "--scope <local|global>", description: "Only list orchestrators from one scope." },
            { flag: "--json", description: "Output the list as JSON." },
        ],
        examples: [
            "rueter orchestrators list",
            "rueter orchestrators list --scope local",
        ],
        async run(context) {
            const scope = readOptionalScope(context.flags.scope)
            const records = await listSavedOrchestrators(context.cwd, scope)

            if (context.flags.json === true) {
                console.log(renderJson(records))
                return 0
            }

            console.log([
                renderHeader("Saved Orchestrators", scope ? `${scope} scope` : "local + global"),
                renderSavedOrchestratorList(records),
            ].join("\n"))
            return 0
        },
    },
    {
        path: ["orchestrators", "show"],
        summary: "Show one saved orchestrator definition in detail.",
        description: "Displays the orchestrator record, referenced models, shared config, and file path.",
        usage: "rueter orchestrators show <name> [--scope <local|global>] [--json]",
        options: [
            { flag: "--scope <local|global>", description: "Resolve the orchestrator from one scope only." },
            { flag: "--json", description: "Output the saved record as JSON." },
        ],
        examples: [
            "rueter orchestrators show frontier-compare",
            "rueter orchestrators show frontier-compare --scope global",
        ],
        async run(context) {
            const name = requirePositionalArg(context.args, 0, "saved orchestrator name")
            const scope = readOptionalScope(context.flags.scope)
            const record = await resolveSavedOrchestrator(name, context.cwd, scope)

            if (context.flags.json === true) {
                console.log(renderJson(record))
                return 0
            }

            console.log(renderSavedOrchestratorDetail(record))
            return 0
        },
    },
    {
        path: ["orchestrators", "run"],
        summary: "Run a prompt against one saved orchestrator.",
        description: "Loads the saved orchestrator, resolves each referenced model, fans the prompt out across them in parallel, and renders all responses together.",
        usage: "rueter orchestrators run <name> [--scope <local|global>] [--prompt <text> | --file <path> | --stdin] [--json]",
        options: [
            { flag: "--scope <local|global>", description: "Resolve the orchestrator from one scope only." },
            { flag: "--prompt <text>", description: "Prompt text to send." },
            { flag: "--file <path>", description: "Read prompt text from a file." },
            { flag: "--stdin", description: "Read prompt text from stdin." },
            { flag: "--json", description: "Output the response object as JSON." },
        ],
        examples: [
            "rueter orchestrators run frontier-compare --prompt \"Design a rate limiter.\"",
            "rueter orchestrators run frontier-compare --file ./prompt.txt",
        ],
        async run(context) {
            const name = requirePositionalArg(context.args, 0, "saved orchestrator name")
            const scope = readOptionalScope(context.flags.scope)
            const record = await resolveSavedOrchestrator(name, context.cwd, scope)
            const prompt = await resolvePromptText({ ...context, args: context.args.slice(1) }, 0, "Enter the prompt for this orchestrator")
            const execution = await executeSavedOrchestratorPrompt(record, prompt)

            if (context.flags.json === true) {
                console.log(renderJson(execution))
                return 0
            }

            console.log(renderOrchestratorExecutionResult(execution))
            return 0
        },
    },
    {
        path: ["orchestrators", "delete"],
        summary: "Delete one saved orchestrator definition.",
        description: "Removes the saved orchestrator JSON file from the selected scope.",
        usage: "rueter orchestrators delete <name> [--scope <local|global>] [--yes] [--json]",
        options: [
            { flag: "--scope <local|global>", description: "Delete from one scope only." },
            { flag: "--yes, -y", description: "Skip the confirmation prompt." },
            { flag: "--json", description: "Output the deleted record as JSON." },
        ],
        examples: [
            "rueter orchestrators delete frontier-compare",
            "rueter orchestrators delete frontier-compare --scope local --yes",
        ],
        async run(context) {
            const name = requirePositionalArg(context.args, 0, "saved orchestrator name")
            const scope = readOptionalScope(context.flags.scope)
            const record = await resolveSavedOrchestrator(name, context.cwd, scope)

            if (readBooleanFlag(context.flags, "yes") !== true && context.interactive) {
                const confirmed = await promptConfirm(`Delete saved orchestrator "${record.definition.name}" from ${record.scope} scope?`, false)
                if (!confirmed) throw new CliError("Orchestrator deletion cancelled.", 130)
            }

            const deleted = await deleteSavedOrchestrator(name, context.cwd, scope)
            if (context.flags.json === true) {
                console.log(renderJson(deleted))
                return 0
            }

            console.log([
                renderHeader("Saved Orchestrator Deleted"),
                `${deleted.definition.name} was removed from ${deleted.scope} scope.`,
            ].join("\n"))
            return 0
        },
    },
]

async function resolveModelRefs(context: Parameters<CommandDefinition["run"]>[0]): Promise<SavedModelRef[]> {
    const modelFlag = readCsvFlag(context.flags, "models")
    if (modelFlag && modelFlag.length > 0) {
        return buildModelReferenceList(modelFlag, context.cwd)
    }

    if (!context.interactive) {
        throw new CliError("Flag --models is required when creating an orchestrator non-interactively.")
    }

    const addressable = await listAddressableModels(context.cwd)
    if (addressable.length === 0) {
        throw new CliError("No saved models exist yet. Create one first with \"rueter models create\".")
    }

    const selected = await multiSelectOptions(
        "Choose the saved models to include in this orchestrator",
        addressable.map(entry => ({
            value: entry.id,
            label: `${entry.record.definition.name} (${entry.record.scope})`,
            hint: `${entry.record.definition.provider} · [${entry.record.definition.modelIndex}] ${entry.record.definition.modelName}`,
        })),
        1
    )

    return selected.map(value => {
        const [scope, name] = value.split(":", 2)
        return { scope: scope as CliScope, name }
    })
}

async function resolveOrchestratorName(context: Parameters<CommandDefinition["run"]>[0]): Promise<string> {
    const nameFlag = readStringFlag(context.flags, "name")
    if (nameFlag) return nameFlag
    if (!context.interactive) throw new CliError("Flag --name is required when creating an orchestrator non-interactively.")
    return await promptText("Saved orchestrator name")
}

async function resolveOrchestratorConfig(
    context: Parameters<CommandDefinition["run"]>[0]
): Promise<{ systemPrompt?: string; temperature?: number; maxTokens?: number }> {
    const systemPrompt = readStringFlag(context.flags, "systemPrompt")
    const temperature = readNumberFlag(context.flags, "temperature")
    const maxTokens = readIntegerFlag(context.flags, "maxTokens")

    if (systemPrompt !== undefined || temperature !== undefined || maxTokens !== undefined || !context.interactive) {
        return {
            ...(systemPrompt ? { systemPrompt } : {}),
            ...(temperature !== undefined ? { temperature } : {}),
            ...(maxTokens !== undefined ? { maxTokens } : {}),
        }
    }

    const interactiveConfig: { systemPrompt?: string; temperature?: number; maxTokens?: number } = {}
    const sharedSystemPrompt = await promptText("Shared system prompt (optional)", { allowEmpty: true })
    if (sharedSystemPrompt.trim().length > 0) interactiveConfig.systemPrompt = sharedSystemPrompt

    const sharedTemperature = await promptNumber("Shared temperature (optional)", { allowEmpty: true, min: 0, max: 1 })
    if (sharedTemperature !== undefined) interactiveConfig.temperature = sharedTemperature

    const sharedMaxTokens = await promptNumber("Shared max tokens (optional)", { allowEmpty: true, integer: true, min: 1, max: 100_000 })
    if (sharedMaxTokens !== undefined) interactiveConfig.maxTokens = sharedMaxTokens

    return interactiveConfig
}

function readOptionalScope(value: unknown): CliScope | undefined {
    if (value === undefined) return undefined
    if (value === "local" || value === "global") return value
    throw new CliError(`Invalid scope "${String(value)}". Use "local" or "global".`)
}

async function resolveScope(value: unknown, interactive: boolean): Promise<CliScope> {
    const scope = readOptionalScope(value)
    if (scope) return scope
    if (!interactive) return "local"
    return await selectOption("Where should this saved orchestrator live?", [
        {
            value: "local",
            label: "Local project (.rueter/)",
            hint: "Best for orchestrators that belong to this repo.",
        },
        {
            value: "global",
            label: "Global user config (~/.config/rueter/)",
            hint: "Best for reusable orchestrators across projects.",
        },
    ])
}
