import type { CommandDefinition } from "../types.js"
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
import { renderHeader, renderJson, renderModelDetail, renderProviderCatalog, renderSubsection, renderTip } from "../ui/render.js"
import { selectOption } from "../ui/select.js"

export const modelCommands: readonly CommandDefinition[] = [
    {
        path: ["models", "catalog"],
        summary: "Browse the built-in provider/model catalog with readable output.",
        description: "Lists the current bundled model indexes by provider. Interactive mode uses highlighted selectors so later model creation can stay obvious and friendly.",
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
                const providerChoice = await selectOption(
                    "Choose a provider to inspect",
                    getProviderSelectOptions()
                )

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
                console.log(renderJson({
                    selectedProvider: selectedProvider ?? null,
                    providers: catalog,
                }))
                return 0
            }

            if (selectedModel) {
                console.log(renderModelDetail(selectedModel))
                return 0
            }

            const blocks = [
                renderHeader("Built-in Model Catalog", selectedProvider ? `${formatProviderName(selectedProvider)} only` : "All providers"),
                ...catalog.map(entry => renderProviderCatalog(entry.provider, entry.models)),
                renderTip("Model indices are the numbers passed to RueterModel(provider, apiKey, modelIndex, config)."),
            ]

            if (!selectedProvider) {
                blocks.splice(1, 0, `${renderSubsection("Providers")}\n  ${getProviders().map(formatProviderName).join(", ")}`)
            }

            console.log(blocks.join("\n\n"))
            return 0
        },
    },
]

function readProviderFlag(value: unknown): ReturnType<typeof getProviders>[number] | undefined {
    if (value === undefined) return undefined
    if (typeof value !== "string" || !isProvider(value)) {
        throw new CliError(`Invalid provider "${String(value)}". Use anthropic, openai, gemini, or grok.`)
    }
    return value
}
