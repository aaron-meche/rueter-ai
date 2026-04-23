import { performance } from "node:perf_hooks"

import { Rueter } from "../../src/models/Rueter.js"
import { RueterModel } from "../../src/models/RueterModel.js"
import type { Provider, RueterModelConfig } from "../../src/const/Types.js"

import { getModelByIndex, getModelIndexByName } from "../../src/helpers/ModelCatalog.js"
import { CliError } from "./errors.js"
import { instantiateSavedModel } from "./models.js"
import { instantiateSavedOrchestrator } from "./orchestrators.js"
import type {
    ModelExecutionResult,
    OrchestratorExecutionResult,
    SavedModelRecord,
    SavedOrchestratorRecord,
} from "../types.js"

export async function executeSavedModelPrompt(record: SavedModelRecord, prompt: string): Promise<ModelExecutionResult> {
    const resolved = await instantiateSavedModel(record)
    return executeSingleModelPrompt({
        name: record.definition.name,
        provider: resolved.provider,
        modelName: resolved.modelName,
        model: resolved.model,
        prompt,
    })
}

export async function executeAdHocModelPrompt(input: {
    name: string
    provider: Provider
    apiKey: string
    modelIndex?: number
    modelName?: string
    config: RueterModelConfig
    prompt: string
}): Promise<ModelExecutionResult> {
    const resolvedIndex = resolveModelIndex(input.provider, input.modelIndex, input.modelName)
    const modelInfo = getModelByIndex(input.provider, resolvedIndex)
    if (!modelInfo) throw new CliError(`Model resolution failed for provider "${input.provider}".`)

    const model = new RueterModel(input.provider, input.apiKey, resolvedIndex, input.config)
    return executeSingleModelPrompt({
        name: input.name,
        provider: input.provider,
        modelName: modelInfo.name,
        model,
        prompt: input.prompt,
    })
}

export async function executeSavedOrchestratorPrompt(
    record: SavedOrchestratorRecord,
    prompt: string
): Promise<OrchestratorExecutionResult> {
    const { orchestrator } = await instantiateSavedOrchestrator(record)
    return executeOrchestratorPrompt(record.definition.name, orchestrator, prompt)
}

export async function executeOrchestratorPrompt(
    name: string,
    orchestrator: Rueter,
    prompt: string
): Promise<OrchestratorExecutionResult> {
    const startedAt = performance.now()
    const result = await orchestrator.prompt(prompt)
    const durationMs = performance.now() - startedAt

    return {
        name,
        prompt,
        durationMs,
        result,
    }
}

async function executeSingleModelPrompt(input: {
    name: string
    provider: Provider
    modelName: string
    model: RueterModel
    prompt: string
}): Promise<ModelExecutionResult> {
    const startedAt = performance.now()
    const result = await input.model.prompt(input.prompt, true)
    const durationMs = performance.now() - startedAt

    return {
        name: input.name,
        provider: input.provider,
        modelName: input.modelName,
        prompt: input.prompt,
        durationMs,
        result,
    }
}

function resolveModelIndex(provider: Provider, modelIndex: number | undefined, modelName: string | undefined): number {
    if (modelName) {
        const byName = getModelIndexByName(provider, modelName)
        if (byName >= 0) return byName
        throw new CliError(`Provider "${provider}" does not have a model named "${modelName}".`)
    }

    if (modelIndex !== undefined && getModelByIndex(provider, modelIndex)) {
        return modelIndex
    }

    throw new CliError(`A valid model index or model name is required for provider "${provider}".`)
}
