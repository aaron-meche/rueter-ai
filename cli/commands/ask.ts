import type { Provider } from "../../src/types.js"

import type { CommandDefinition } from "../types.js"
import { formatProviderName, getIndexedModels, getModelSelectOptions, getProviderSelectOptions, isProvider } from "../core/catalog.js"
import { resolveApiKeyValue } from "../core/env.js"
import { CliError } from "../core/errors.js"
import { readIntegerFlag, readStringFlag } from "../core/flags.js"
import { recordHistory } from "../core/history.js"
import { resolvePromptText } from "../core/input.js"
import { getModelConfigFromFlags } from "../core/models.js"
import { resolveSavedOrchestrator } from "../core/orchestrators.js"
import { executeAdHocModelPrompt, executeSavedModelPrompt, executeSavedOrchestratorPrompt } from "../core/runtime.js"
import { resolveSavedModel } from "../core/models.js"
import {
    renderJson,
    renderModelExecutionResult,
    renderOrchestratorExecutionResult,
    renderRawModelResult,
    renderRawOrchestratorResult,
} from "../ui/render.js"
import { selectOption } from "../ui/select.js"

export const askCommand: CommandDefinition = {
    path: ["ask"],
    summary: "Run a one-off prompt with a saved model, saved orchestrator, or ad hoc provider/model.",
    description: "Use this for quick terminal prompting without first creating a saved definition. It can target a saved model, a saved orchestrator, or a direct provider + built-in model selection.",
    usage: "rueter ask [--model <saved-name> | --orchestrator <saved-name> | --provider <provider> --index <n>|--model-name <name>] [--prompt <text> | --file <path> | --stdin] [--raw] [--json]",
    options: [
        { flag: "--model <name>", description: "Saved model name when no provider is specified, or exact built-in model name when --provider is present." },
        { flag: "--orchestrator <name>", description: "Saved orchestrator name." },
        { flag: "--provider <provider>", description: "Direct provider target: anthropic, openai, gemini, or grok." },
        { flag: "--index <n>", description: "Built-in model index for direct provider mode." },
        { flag: "--model-name <name>", description: "Exact built-in model name for direct provider mode." },
        { flag: "--api-key-env <ENV>", description: "Explicit environment variable containing the API key for direct provider mode." },
        { flag: "--prompt <text>", description: "Prompt text to send." },
        { flag: "--file <path>", description: "Read prompt text from a file." },
        { flag: "--stdin", description: "Read prompt text from stdin." },
        { flag: "--raw", description: "Print only response text." },
        { flag: "--no-history", description: "Do not record this run in local CLI history." },
        { flag: "--json", description: "Output the response as JSON." },
    ],
    examples: [
        "rueter ask --model openai-main --prompt \"Summarize this file.\"",
        "rueter ask --orchestrator frontier-compare --prompt \"Design a cache strategy.\"",
        "rueter ask --provider openai --model-name gpt-5.4 --prompt \"Explain optimistic locking.\"",
    ],
    async run(context) {
        const prompt = await resolvePromptText(context, 0, "Enter the prompt to send")
        const savedOrchestratorName = readStringFlag(context.flags, "orchestrator")
        const providerFlag = readStringFlag(context.flags, "provider")
        const modelFlag = readStringFlag(context.flags, "model")

        if (savedOrchestratorName) {
            const record = await resolveSavedOrchestrator(savedOrchestratorName, context.cwd)
            const execution = await executeSavedOrchestratorPrompt(record, prompt)
            await recordHistory(context, {
                targetType: "ask",
                targetName: `orchestrator:${record.definition.name}`,
                prompt,
                durationMs: execution.durationMs,
                result: execution,
            })
            if (context.flags.json === true) console.log(renderJson(execution))
            else if (context.flags.raw === true) console.log(renderRawOrchestratorResult(execution))
            else console.log(renderOrchestratorExecutionResult(execution))
            return 0
        }

        if (!providerFlag && modelFlag) {
            const record = await resolveSavedModel(modelFlag, context.cwd)
            const execution = await executeSavedModelPrompt(record, prompt)
            await recordHistory(context, {
                targetType: "ask",
                targetName: `model:${record.definition.name}`,
                provider: record.definition.provider,
                modelName: record.definition.modelName,
                prompt,
                durationMs: execution.durationMs,
                result: execution,
            })
            if (context.flags.json === true) console.log(renderJson(execution))
            else if (context.flags.raw === true) console.log(renderRawModelResult(execution))
            else console.log(renderModelExecutionResult(execution))
            return 0
        }

        const provider = await resolveProvider(providerFlag, context.interactive)
        const selection = await resolveDirectModelSelection(context, provider)
        const apiKeyEnv = readStringFlag(context.flags, "apiKeyEnv")
        const { envName, apiKey } = resolveApiKeyValue(provider, apiKeyEnv)
        const config = getModelConfigFromFlags(provider, context.flags)

        const execution = await executeAdHocModelPrompt({
            name: `${provider}:${selection.name}`,
            provider,
            apiKey,
            modelIndex: selection.index,
            config,
            prompt,
        })
        await recordHistory(context, {
            targetType: "ask",
            targetName: `${provider}:${selection.name}`,
            provider,
            modelName: selection.name,
            prompt,
            durationMs: execution.durationMs,
            result: execution,
        })

        if (context.flags.json === true) {
            console.log(renderJson({
                apiKeyEnv: envName,
                ...execution,
            }))
            return 0
        }

        if (context.flags.raw === true) {
            console.log(renderRawModelResult(execution))
            return 0
        }

        console.log(renderModelExecutionResult(execution))
        return 0
    },
}

async function resolveProvider(providerFlag: string | undefined, interactive: boolean): Promise<Provider> {
    if (providerFlag) {
        if (!isProvider(providerFlag)) throw new CliError(`Invalid provider "${providerFlag}".`)
        return providerFlag
    }

    if (!interactive) {
        throw new CliError("Provide --model for a saved model, --orchestrator for a saved orchestrator, or --provider for a direct one-off prompt.")
    }

    const selected = await selectOption("Choose a provider for this one-off prompt", getProviderSelectOptions().filter(option => option.value !== "all"))
    if (selected === "all") throw new CliError("Interactive provider selection returned an invalid value.")
    return selected
}

async function resolveDirectModelSelection(
    context: Parameters<CommandDefinition["run"]>[0],
    provider: Provider
): Promise<{ index: number; name: string }> {
    const explicitModelName = readStringFlag(context.flags, "modelName") ?? (readStringFlag(context.flags, "provider") ? readStringFlag(context.flags, "model") : undefined)
    const indexFlag = readIntegerFlag(context.flags, "index")

    if (explicitModelName) {
        const match = getIndexedModels(provider).find(model => model.name === explicitModelName)
        if (!match) throw new CliError(`Provider "${provider}" does not have a built-in model named "${explicitModelName}".`)
        return { index: match.index, name: match.name }
    }

    if (indexFlag !== undefined) {
        const match = getIndexedModels(provider).find(model => model.index === indexFlag)
        if (!match) throw new CliError(`Provider "${provider}" does not have a built-in model at index ${indexFlag}.`)
        return { index: match.index, name: match.name }
    }

    if (!context.interactive) {
        throw new CliError(`Provide --index or --model-name for direct provider mode (${provider}).`)
    }

    const selectedIndex = await selectOption(
        `Choose a ${formatProviderName(provider)} model`,
        getModelSelectOptions(provider)
    )
    const match = getIndexedModels(provider).find(model => String(model.index) === selectedIndex)
    if (!match) throw new CliError("Interactive model selection failed.")
    return { index: match.index, name: match.name }
}
