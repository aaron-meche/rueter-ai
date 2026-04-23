import type { Provider, RueterModelConfig } from "../../src/const/Types.js"

import type { CliScope, CommandDefinition } from "../types.js"
import {
    formatProviderName,
    getIndexedModels,
    getModelSelectOptions,
    getProviderSelectOptions,
    getProviders,
    isProvider,
    type IndexedModelInfo,
} from "../core/catalog.js"
import { CliError } from "../core/errors.js"
import {
    getDefaultApiKeyEnv,
    getModelConfigFromFlags,
    listSavedModels,
    resolveSavedModel,
    saveSavedModel,
    deleteSavedModel,
    suggestModelDefinitionName,
    SUPPORTED_MODEL_CONFIG_FIELDS,
} from "../core/models.js"
import { resolvePromptText } from "../core/input.js"
import { executeSavedModelPrompt } from "../core/runtime.js"
import { readBooleanFlag, readIntegerFlag, readStringFlag, requirePositionalArg } from "../core/flags.js"
import {
    renderHeader,
    renderJson,
    renderModelDetail,
    renderModelExecutionResult,
    renderProviderCatalog,
    renderSavedModelDetail,
    renderSavedModelList,
    renderSubsection,
    renderTip,
} from "../ui/render.js"
import { promptConfirm, promptNumber, promptText } from "../ui/prompt.js"
import { selectOption } from "../ui/select.js"

export const modelCommands: readonly CommandDefinition[] = [
    {
        path: ["models", "catalog"],
        summary: "Browse the built-in provider/model catalog with readable output.",
        description: "Lists the bundled model catalog. Interactive mode uses highlighted selectors so users can see each numeric index together with the model name before saving a definition.",
        usage: "rueter models catalog [--provider <name>] [--interactive] [--json]",
        options: [
            { flag: "--provider <anthropic|openai|gemini|grok>", description: "Limit the catalog to a single provider." },
            { flag: "--interactive", description: "Open a highlighted selector to inspect a provider and model." },
            { flag: "--json", description: "Output the catalog in JSON form." },
        ],
        examples: [
            "rueter models catalog",
            "rueter models catalog --provider openai",
            "rueter models catalog --interactive",
        ],
        async run(context) {
            const jsonMode = context.flags.json === true
            const interactiveMode = context.flags.interactive === true && !jsonMode
            let selectedProvider = readProviderFlag(context.flags.provider)
            let selectedModel: IndexedModelInfo | undefined

            if (interactiveMode) {
                const providerChoice = await selectOption("Choose a provider to inspect", getProviderSelectOptions())
                if (providerChoice !== "all") {
                    selectedProvider = providerChoice
                    const modelIndex = await selectOption(
                        `Choose a ${formatProviderName(selectedProvider)} model`,
                        getModelSelectOptions(selectedProvider)
                    )
                    selectedModel = getIndexedModels(selectedProvider).find(model => String(model.index) === modelIndex)
                }
            }

            const providersToRender = selectedProvider ? [selectedProvider] : getProviders()
            const catalog = providersToRender.map(provider => ({
                provider,
                models: getIndexedModels(provider),
            }))

            if (jsonMode) {
                console.log(renderJson({ selectedProvider: selectedProvider ?? null, providers: catalog }))
                return 0
            }

            if (selectedModel) {
                console.log(renderModelDetail(selectedModel))
                return 0
            }

            const blocks = [
                renderHeader("Built-in Model Catalog", selectedProvider ? `${formatProviderName(selectedProvider)} only` : "All providers"),
                ...catalog.map(entry => renderProviderCatalog(entry.provider, entry.models)),
                renderTip("The numeric index is the third argument passed to RueterModel(provider, apiKey, modelIndex, config)."),
            ]

            if (!selectedProvider) {
                blocks.splice(1, 0, `${renderSubsection("Providers")}\n  ${getProviders().map(formatProviderName).join(", ")}`)
            }

            console.log(blocks.join("\n\n"))
            return 0
        },
    },
    {
        path: ["models", "create"],
        summary: "Create and save a named RueterModel definition.",
        description: "Stores a reusable RueterModel configuration in local or global CLI storage. Interactive mode guides provider, model index, API key env var, and advanced config choices with readable selectors and prompts.",
        usage: "rueter models create [--name <name>] [--provider <provider>] [--index <n>] [--model-name <name>] [--scope <local|global>] [--api-key-env <ENV>] [--force]",
        options: [
            { flag: "--name <name>", description: "Saved model definition name." },
            { flag: "--provider <provider>", description: "Provider: anthropic, openai, gemini, or grok." },
            { flag: "--index <n>", description: "Built-in numeric model index for the chosen provider." },
            { flag: "--model-name <name>", description: "Resolve the model by exact built-in model name instead of index." },
            { flag: "--api-key-env <ENV>", description: "Environment variable that contains the provider API key." },
            { flag: "--scope <local|global>", description: "Where to save the definition." },
            { flag: "--system-prompt <text>", description: "Optional system prompt." },
            { flag: "--temperature <n>", description: "Optional temperature between 0 and 1." },
            { flag: "--max-tokens <n>", description: "Optional max token limit." },
            { flag: "--top-p <n>", description: "Optional top-p, when supported by the provider." },
            { flag: "--top-k <n>", description: "Optional top-k, when supported by the provider." },
            { flag: "--frequency-penalty <n>", description: "Optional frequency penalty, when supported." },
            { flag: "--presence-penalty <n>", description: "Optional presence penalty, when supported." },
            { flag: "--stop <a,b,c>", description: "Optional comma-separated stop sequences." },
            { flag: "--n <n>", description: "Optional candidate count, when supported." },
            { flag: "--force", description: "Overwrite the saved definition if it already exists." },
            { flag: "--json", description: "Output the saved definition as JSON." },
        ],
        examples: [
            "rueter models create",
            "rueter models create --name openai-main --provider openai --index 2 --api-key-env OPENAI_API_KEY",
            "rueter models create --name grok-fast --provider grok --model-name grok-4-1-fast-reasoning",
        ],
        async run(context) {
            const scope = await resolveScope(context.flags.scope, context.interactive)
            const provider = await resolveProvider(context)
            const selection = await resolveModelSelection(context, provider)
            const name = await resolveModelName(context, provider, selection.index)
            const apiKeyEnv = await resolveApiKeyEnvInput(context, provider)
            const config = await resolveModelConfigInput(context, provider)
            const record = await saveSavedModel({
                name,
                provider,
                modelName: selection.name,
                modelIndex: selection.index,
                apiKeyEnv,
                config,
            }, scope, context.cwd, context.flags.force === true)

            if (context.flags.json === true) {
                console.log(renderJson(record))
                return 0
            }

            console.log([
                renderHeader("Saved Model Created", `${record.definition.name} · ${record.scope} scope`),
                renderSavedModelDetail(record),
                "",
                renderTip(`Run it with: rueter models run ${record.definition.name} --prompt "Hello"`),
            ].join("\n"))

            return 0
        },
    },
    {
        path: ["models", "list"],
        summary: "List saved model definitions from local and global CLI storage.",
        description: "Shows saved model definitions grouped across scopes so you can quickly see what is reusable in the current project vs globally on your machine.",
        usage: "rueter models list [--scope <local|global>] [--json]",
        options: [
            { flag: "--scope <local|global>", description: "Only list models from one scope." },
            { flag: "--json", description: "Output the list as JSON." },
        ],
        examples: [
            "rueter models list",
            "rueter models list --scope local",
        ],
        async run(context) {
            const scope = readOptionalScope(context.flags.scope)
            const records = await listSavedModels(context.cwd, scope)

            if (context.flags.json === true) {
                console.log(renderJson(records))
                return 0
            }

            console.log([
                renderHeader("Saved Models", scope ? `${scope} scope` : "local + global"),
                renderSavedModelList(records),
            ].join("\n"))
            return 0
        },
    },
    {
        path: ["models", "show"],
        summary: "Show one saved model definition in detail.",
        description: "Displays the full saved model record, including provider, resolved built-in model index, API env var, and advanced config.",
        usage: "rueter models show <name> [--scope <local|global>] [--json]",
        options: [
            { flag: "--scope <local|global>", description: "Resolve the definition from one scope only." },
            { flag: "--json", description: "Output the definition as JSON." },
        ],
        examples: [
            "rueter models show openai-main",
            "rueter models show openai-main --scope global",
        ],
        async run(context) {
            const name = requirePositionalArg(context.args, 0, "saved model name")
            const scope = readOptionalScope(context.flags.scope)
            const record = await resolveSavedModel(name, context.cwd, scope)

            if (context.flags.json === true) {
                console.log(renderJson(record))
                return 0
            }

            console.log(renderSavedModelDetail(record))
            return 0
        },
    },
    {
        path: ["models", "run"],
        summary: "Run a prompt against one saved model definition.",
        description: "Loads the saved definition, resolves its API key from the environment, sends a prompt, and prints the response with usage cost when available.",
        usage: "rueter models run <name> [--scope <local|global>] [--prompt <text> | --file <path> | --stdin] [--json]",
        options: [
            { flag: "--scope <local|global>", description: "Resolve the definition from one scope only." },
            { flag: "--prompt <text>", description: "Prompt text to send." },
            { flag: "--file <path>", description: "Read prompt text from a file." },
            { flag: "--stdin", description: "Read prompt text from stdin." },
            { flag: "--json", description: "Output the response as JSON." },
        ],
        examples: [
            "rueter models run openai-main --prompt \"Explain TCP in 3 sentences.\"",
            "rueter models run openai-main --file ./prompt.txt",
        ],
        async run(context) {
            const name = requirePositionalArg(context.args, 0, "saved model name")
            const scope = readOptionalScope(context.flags.scope)
            const record = await resolveSavedModel(name, context.cwd, scope)
            const prompt = await resolvePromptText({ ...context, args: context.args.slice(1) }, 0, "Enter the prompt for this saved model")
            const execution = await executeSavedModelPrompt(record, prompt)

            if (context.flags.json === true) {
                console.log(renderJson(execution))
                return 0
            }

            console.log(renderModelExecutionResult(execution))
            return 0
        },
    },
    {
        path: ["models", "test"],
        summary: "Smoke-test one saved model definition with a lightweight prompt.",
        description: "Resolves the saved model and sends a short test prompt so you can verify the API key, model selection, and connectivity without wiring a full run command.",
        usage: "rueter models test <name> [--scope <local|global>] [--prompt <text>] [--json]",
        options: [
            { flag: "--scope <local|global>", description: "Resolve the definition from one scope only." },
            { flag: "--prompt <text>", description: "Custom test prompt. Defaults to a lightweight connectivity check." },
            { flag: "--json", description: "Output the response as JSON." },
        ],
        examples: [
            "rueter models test openai-main",
            "rueter models test openai-main --prompt \"Reply with exactly OK\"",
        ],
        async run(context) {
            const name = requirePositionalArg(context.args, 0, "saved model name")
            const scope = readOptionalScope(context.flags.scope)
            const record = await resolveSavedModel(name, context.cwd, scope)
            const prompt = readStringFlag(context.flags, "prompt") ?? "Reply with exactly the word OK."
            const execution = await executeSavedModelPrompt(record, prompt)

            if (context.flags.json === true) {
                console.log(renderJson(execution))
                return 0
            }

            console.log(renderModelExecutionResult(execution))
            return 0
        },
    },
    {
        path: ["models", "delete"],
        summary: "Delete one saved model definition.",
        description: "Removes the saved model JSON file from the selected scope. If the definition exists in both scopes, pass --scope to avoid ambiguity.",
        usage: "rueter models delete <name> [--scope <local|global>] [--yes] [--json]",
        options: [
            { flag: "--scope <local|global>", description: "Delete from one scope only." },
            { flag: "--yes, -y", description: "Skip the confirmation prompt." },
            { flag: "--json", description: "Output the deleted record as JSON." },
        ],
        examples: [
            "rueter models delete openai-main",
            "rueter models delete openai-main --scope global --yes",
        ],
        async run(context) {
            const name = requirePositionalArg(context.args, 0, "saved model name")
            const scope = readOptionalScope(context.flags.scope)
            const record = await resolveSavedModel(name, context.cwd, scope)

            if (readBooleanFlag(context.flags, "yes") !== true && context.interactive) {
                const confirmed = await promptConfirm(`Delete saved model "${record.definition.name}" from ${record.scope} scope?`, false)
                if (!confirmed) throw new CliError("Model deletion cancelled.", 130)
            }

            const deleted = await deleteSavedModel(name, context.cwd, scope)

            if (context.flags.json === true) {
                console.log(renderJson(deleted))
                return 0
            }

            console.log([
                renderHeader("Saved Model Deleted"),
                `${deleted.definition.name} was removed from ${deleted.scope} scope.`,
            ].join("\n"))
            return 0
        },
    },
]

async function resolveProvider(context: Parameters<CommandDefinition["run"]>[0]): Promise<Provider> {
    const providerFlag = readStringFlag(context.flags, "provider")
    if (providerFlag) {
        if (!isProvider(providerFlag)) throw new CliError(`Invalid provider "${providerFlag}".`)
        return providerFlag
    }

    if (!context.interactive) throw new CliError("Flag --provider is required when not using an interactive terminal.")
    const selected = await selectOption("Choose a provider", getProviderSelectOptions().filter(option => option.value !== "all"))
    if (selected === "all") throw new CliError("Interactive provider selection returned an invalid value.")
    return selected
}

async function resolveModelSelection(
    context: Parameters<CommandDefinition["run"]>[0],
    provider: Provider
): Promise<{ index: number; name: string }> {
    const modelNameFlag = readStringFlag(context.flags, "modelName")
    const indexFlag = readIntegerFlag(context.flags, "index")

    if (modelNameFlag) {
        const match = getIndexedModels(provider).find(model => model.name === modelNameFlag)
        if (!match) throw new CliError(`Provider "${provider}" does not have a built-in model named "${modelNameFlag}".`)
        return { index: match.index, name: match.name }
    }

    if (indexFlag !== undefined) {
        const match = getIndexedModels(provider).find(model => model.index === indexFlag)
        if (!match) throw new CliError(`Provider "${provider}" does not have a built-in model at index ${indexFlag}.`)
        return { index: match.index, name: match.name }
    }

    if (!context.interactive) {
        throw new CliError("Provide either --index or --model-name when creating a model non-interactively.")
    }

    const selectedIndex = await selectOption(
        `Choose a ${formatProviderName(provider)} model`,
        getModelSelectOptions(provider)
    )
    const match = getIndexedModels(provider).find(model => String(model.index) === selectedIndex)
    if (!match) throw new CliError("Interactive model selection failed.")
    return { index: match.index, name: match.name }
}

async function resolveModelName(
    context: Parameters<CommandDefinition["run"]>[0],
    provider: Provider,
    modelIndex: number
): Promise<string> {
    const nameFlag = readStringFlag(context.flags, "name")
    if (nameFlag) return nameFlag

    if (!context.interactive) throw new CliError("Flag --name is required when creating a model non-interactively.")
    return await promptText("Saved model name", {
        defaultValue: suggestModelDefinitionName(provider, modelIndex),
    })
}

async function resolveApiKeyEnvInput(
    context: Parameters<CommandDefinition["run"]>[0],
    provider: Provider
): Promise<string> {
    const envFlag = readStringFlag(context.flags, "apiKeyEnv")
    if (envFlag) return envFlag

    if (!context.interactive) return getDefaultApiKeyEnv(provider)
    return await promptText("API key environment variable", {
        defaultValue: getDefaultApiKeyEnv(provider),
    })
}

async function resolveModelConfigInput(
    context: Parameters<CommandDefinition["run"]>[0],
    provider: Provider
): Promise<RueterModelConfig> {
    const directConfig = getModelConfigFromFlags(provider, context.flags)
    if (Object.keys(directConfig).length > 0 || !context.interactive) return directConfig

    const config: RueterModelConfig = {}
    const systemPrompt = await promptText("System prompt (optional)", { allowEmpty: true })
    if (systemPrompt.trim().length > 0) config.systemPrompt = systemPrompt

    const temperature = await promptNumber("Temperature (optional)", { allowEmpty: true, min: 0, max: 1 })
    if (temperature !== undefined) config.temperature = temperature

    const maxTokens = await promptNumber("Max tokens (optional)", { allowEmpty: true, integer: true, min: 1, max: 100_000 })
    if (maxTokens !== undefined) config.maxTokens = maxTokens

    const wantsAdvanced = await promptConfirm("Configure provider-specific advanced sampling options?", false)
    if (!wantsAdvanced) return config

    const supportedFields = SUPPORTED_MODEL_CONFIG_FIELDS[provider]
    if (supportedFields.has("topP")) {
        const topP = await promptNumber("topP (optional)", { allowEmpty: true, min: 0, max: 1 })
        if (topP !== undefined) config.topP = topP
    }
    if (supportedFields.has("topK")) {
        const topK = await promptNumber("topK (optional)", { allowEmpty: true, integer: true, min: 1 })
        if (topK !== undefined) config.topK = topK
    }
    if (supportedFields.has("frequencyPenalty")) {
        const frequencyPenalty = await promptNumber("frequencyPenalty (optional)", { allowEmpty: true })
        if (frequencyPenalty !== undefined) config.frequencyPenalty = frequencyPenalty
    }
    if (supportedFields.has("presencePenalty")) {
        const presencePenalty = await promptNumber("presencePenalty (optional)", { allowEmpty: true })
        if (presencePenalty !== undefined) config.presencePenalty = presencePenalty
    }
    if (supportedFields.has("n")) {
        const n = await promptNumber("n / candidate count (optional)", { allowEmpty: true, integer: true, min: 1, max: 100 })
        if (n !== undefined) config.n = n
    }
    if (supportedFields.has("stopSequences")) {
        const stopSequences = await promptText("Stop sequences, comma-separated (optional)", { allowEmpty: true })
        const parsed = stopSequences.split(",").map(part => part.trim()).filter(Boolean)
        if (parsed.length > 0) config.stopSequences = parsed
    }

    return config
}

function readProviderFlag(value: unknown): ReturnType<typeof getProviders>[number] | undefined {
    if (value === undefined) return undefined
    if (typeof value !== "string" || !isProvider(value)) {
        throw new CliError(`Invalid provider "${String(value)}". Use anthropic, openai, gemini, or grok.`)
    }
    return value
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
    return await selectOption("Where should this saved model live?", [
        {
            value: "local",
            label: "Local project (.rueter/)",
            hint: "Best for project-specific model definitions.",
        },
        {
            value: "global",
            label: "Global user config (~/.config/rueter/)",
            hint: "Best for reusable models shared across projects.",
        },
    ])
}
