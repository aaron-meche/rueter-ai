import * as nodePath from "node:path"

import { RueterModel } from "../../src/models/RueterModel.js"
import type { Provider, RueterModelConfig } from "../../src/types.js"
import { getModelByIndex, getModelIndexByName } from "../../src/catalog/index.js"

import { getIndexedModels, getProviders } from "./catalog.js"
import { initializeCliConfig, type CliScope, getScopePathInfo } from "./config.js"
import { providerApiKeyEnvVars } from "./env.js"
import { CliError } from "./errors.js"
import { listJsonFiles, readJsonFile, removeFile, sanitizeDefinitionName, writeJsonFile } from "./files.js"
import type { CliFlags, SavedModelDefinition, SavedModelRecord } from "../types.js"
import { readCsvFlag, readIntegerFlag, readNumberFlag, readStringFlag } from "./flags.js"

export const SUPPORTED_MODEL_CONFIG_FIELDS: Record<Provider, ReadonlySet<keyof RueterModelConfig>> = {
    anthropic: new Set(["systemPrompt", "temperature", "maxTokens", "topP", "topK", "stopSequences"]),
    openai: new Set(["systemPrompt", "temperature", "maxTokens", "topP", "frequencyPenalty", "presencePenalty", "stopSequences", "n"]),
    gemini: new Set(["systemPrompt", "temperature", "maxTokens", "topP", "topK", "stopSequences", "n"]),
    grok: new Set(["systemPrompt", "temperature", "maxTokens", "topP", "frequencyPenalty", "presencePenalty", "stopSequences", "n"]),
}

export interface CreateSavedModelInput {
    name: string
    provider: Provider
    modelName: string
    modelIndex: number
    apiKeyEnv: string
    config: RueterModelConfig
}

export async function listSavedModels(cwd = process.cwd(), scope?: CliScope): Promise<SavedModelRecord[]> {
    const scopes = scope ? [scope] : (["local", "global"] as const)
    const allRecords: SavedModelRecord[] = []

    for (const currentScope of scopes) {
        const directory = nodePath.join(getScopePathInfo(currentScope, cwd).rootDir, "models")
        const files = await listJsonFiles(directory)
        for (const filePath of files) {
            const definition = await readJsonFile<SavedModelDefinition>(filePath)
            assertSavedModelDefinition(definition, filePath)
            allRecords.push({ scope: currentScope, filePath, definition })
        }
    }

    return allRecords.sort((left, right) => {
        if (left.definition.name === right.definition.name) return left.scope.localeCompare(right.scope)
        return left.definition.name.localeCompare(right.definition.name)
    })
}

export async function resolveSavedModel(
    name: string,
    cwd = process.cwd(),
    scope?: CliScope
): Promise<SavedModelRecord> {
    const safeName = sanitizeDefinitionName(name)
    const matches = (await listSavedModels(cwd, scope)).filter(record => record.definition.name === safeName)

    if (matches.length === 0) throw new CliError(`Saved model "${safeName}" was not found.`)
    if (!scope && matches.length > 1) {
        throw new CliError(`Saved model "${safeName}" exists in both local and global scope. Re-run with --scope.`)
    }

    return matches[0]
}

export async function saveSavedModel(
    input: CreateSavedModelInput,
    scope: CliScope,
    cwd = process.cwd(),
    force = false
): Promise<SavedModelRecord> {
    const safeName = sanitizeDefinitionName(input.name)
    await initializeCliConfig(scope, cwd)

    const existing = (await listSavedModels(cwd, scope)).find(record => record.definition.name === safeName)
    if (existing && !force) {
        throw new CliError(`A saved model named "${safeName}" already exists in ${scope} scope. Use --force to overwrite it.`)
    }

    const validatedProvider = assertProvider(input.provider)
    const modelIndex = resolveModelIndex(validatedProvider, input.modelIndex, input.modelName)
    const modelInfo = getModelByIndex(validatedProvider, modelIndex)
    if (!modelInfo) throw new CliError(`Model index ${modelIndex} is invalid for provider "${validatedProvider}".`)

    const definition: SavedModelDefinition = {
        version: 1,
        kind: "model",
        name: safeName,
        provider: validatedProvider,
        modelName: modelInfo.name,
        modelIndex,
        apiKeyEnv: input.apiKeyEnv.trim(),
        config: validateModelConfig(validatedProvider, input.config),
        createdAt: existing?.definition.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }

    const filePath = getSavedModelFilePath(scope, safeName, cwd)
    await writeJsonFile(filePath, definition)
    return { scope, filePath, definition }
}

export async function deleteSavedModel(name: string, cwd = process.cwd(), scope?: CliScope): Promise<SavedModelRecord> {
    const record = await resolveSavedModel(name, cwd, scope)
    await removeFile(record.filePath)
    return record
}

export async function instantiateSavedModel(record: SavedModelRecord): Promise<{
    model: RueterModel
    provider: Provider
    modelName: string
    apiKeyEnv: string
}> {
    const apiKey = process.env[record.definition.apiKeyEnv]
    if (!apiKey) {
        throw new CliError(`Environment variable "${record.definition.apiKeyEnv}" is not set for saved model "${record.definition.name}".`)
    }

    const resolvedIndex = resolveModelIndex(record.definition.provider, record.definition.modelIndex, record.definition.modelName)
    const resolvedInfo = getModelByIndex(record.definition.provider, resolvedIndex)
    if (!resolvedInfo) throw new CliError(`Saved model "${record.definition.name}" references an unavailable model.`)

    return {
        model: new RueterModel(record.definition.provider, apiKey, resolvedIndex, record.definition.config),
        provider: record.definition.provider,
        modelName: resolvedInfo.name,
        apiKeyEnv: record.definition.apiKeyEnv,
    }
}

export function getDefaultApiKeyEnv(provider: Provider): string {
    return providerApiKeyEnvVars[provider][0]
}

export function getModelConfigFromFlags(provider: Provider, flags: CliFlags): RueterModelConfig {
    const config: RueterModelConfig = {
        systemPrompt: readStringFlag(flags, "systemPrompt"),
        temperature: readNumberFlag(flags, "temperature"),
        maxTokens: readIntegerFlag(flags, "maxTokens"),
        topP: readNumberFlag(flags, "topP"),
        topK: readIntegerFlag(flags, "topK"),
        frequencyPenalty: readNumberFlag(flags, "frequencyPenalty"),
        presencePenalty: readNumberFlag(flags, "presencePenalty"),
        n: readIntegerFlag(flags, "n"),
    }

    const stopSequences = readCsvFlag(flags, "stop")
    if (stopSequences && stopSequences.length > 0) config.stopSequences = stopSequences

    return validateModelConfig(provider, config)
}

export function suggestModelDefinitionName(provider: Provider, modelIndex: number): string {
    const model = getIndexedModels(provider).find(entry => entry.index === modelIndex)
    if (!model) return `${provider}-model`
    return `${provider}-${model.name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()}`
}

export function getModelFileDisplay(record: SavedModelRecord): string {
    return `${record.definition.name} (${record.scope})`
}

function getSavedModelFilePath(scope: CliScope, name: string, cwd: string): string {
    return nodePath.join(getScopePathInfo(scope, cwd).rootDir, "models", `${name}.json`)
}

function assertSavedModelDefinition(value: SavedModelDefinition, filePath: string): void {
    if (!value || value.kind !== "model" || typeof value.name !== "string") {
        throw new CliError(`Invalid saved model definition in "${filePath}".`)
    }
}

function validateModelConfig(provider: Provider, config: RueterModelConfig): RueterModelConfig {
    const allowedFields = SUPPORTED_MODEL_CONFIG_FIELDS[provider]
    const sanitized: RueterModelConfig = {}

    for (const [key, rawValue] of Object.entries(config) as Array<[keyof RueterModelConfig, RueterModelConfig[keyof RueterModelConfig]]>) {
        if (rawValue === undefined) continue
        if (!allowedFields.has(key)) {
            throw new CliError(`Provider "${provider}" does not support "${String(key)}" in the current CLI.`)
        }

        switch (key) {
            case "systemPrompt":
                if (typeof rawValue !== "string") throw new CliError("systemPrompt must be a string.")
                if (rawValue.trim().length > 0) sanitized.systemPrompt = rawValue.trim()
                break
            case "temperature":
                if (typeof rawValue !== "number") throw new CliError("temperature must be a number.")
                assertRange(rawValue, "temperature", 0, 1)
                sanitized.temperature = rawValue
                break
            case "maxTokens":
                if (typeof rawValue !== "number") throw new CliError("maxTokens must be a number.")
                assertInteger(rawValue, "maxTokens", 1, 100_000)
                sanitized.maxTokens = rawValue
                break
            case "topP":
                if (typeof rawValue !== "number") throw new CliError("topP must be a number.")
                assertRange(rawValue, "topP", 0, 1)
                sanitized.topP = rawValue
                break
            case "topK":
                if (typeof rawValue !== "number") throw new CliError("topK must be a number.")
                assertInteger(rawValue, "topK", 1, Number.MAX_SAFE_INTEGER)
                sanitized.topK = rawValue
                break
            case "frequencyPenalty":
                if (typeof rawValue !== "number") throw new CliError("frequencyPenalty must be a number.")
                assertFiniteNumber(rawValue, "frequencyPenalty")
                sanitized.frequencyPenalty = rawValue
                break
            case "presencePenalty":
                if (typeof rawValue !== "number") throw new CliError("presencePenalty must be a number.")
                assertFiniteNumber(rawValue, "presencePenalty")
                sanitized.presencePenalty = rawValue
                break
            case "n":
                if (typeof rawValue !== "number") throw new CliError("n must be a number.")
                assertInteger(rawValue, "n", 1, 100)
                sanitized.n = rawValue
                break
            case "stopSequences":
                if (!Array.isArray(rawValue)) throw new CliError("stopSequences must be an array of strings.")
                sanitized.stopSequences = rawValue.map(item => String(item)).filter(item => item.trim().length > 0)
                break
        }
    }

    return sanitized
}

function resolveModelIndex(provider: Provider, modelIndex: number | undefined, modelName: string | undefined): number {
    if (modelName) {
        const resolvedByName = getModelIndexByName(provider, modelName)
        if (resolvedByName >= 0) return resolvedByName
    }

    if (modelIndex !== undefined) {
        const modelInfo = getModelByIndex(provider, modelIndex)
        if (modelInfo) return modelIndex
    }

    throw new CliError(`Unable to resolve a valid model for provider "${provider}".`)
}

function assertProvider(provider: string): Provider {
    if (!getProviders().includes(provider as Provider)) {
        throw new CliError(`Invalid provider "${provider}". Use one of: ${getProviders().join(", ")}`)
    }
    return provider as Provider
}

function assertRange(value: number, label: string, min: number, max: number): void {
    assertFiniteNumber(value, label)
    if (value < min || value > max) throw new CliError(`${label} must be between ${min} and ${max}.`)
}

function assertInteger(value: number, label: string, min: number, max: number): void {
    if (!Number.isInteger(value)) throw new CliError(`${label} must be an integer.`)
    if (value < min || value > max) throw new CliError(`${label} must be between ${min} and ${max}.`)
}

function assertFiniteNumber(value: number, label: string): void {
    if (!Number.isFinite(value)) throw new CliError(`${label} must be a valid number.`)
}
