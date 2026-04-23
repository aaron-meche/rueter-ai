import * as nodePath from "node:path"

import { Rueter } from "../../src/models/Rueter.js"
import type { RueterModelConfig } from "../../src/types.js"

import { initializeCliConfig, getScopePathInfo, type CliScope } from "./config.js"
import { CliError } from "./errors.js"
import { listJsonFiles, readJsonFile, removeFile, sanitizeDefinitionName, writeJsonFile } from "./files.js"
import { instantiateSavedModel, listSavedModels, resolveSavedModel } from "./models.js"
import type { SavedModelRecord, SavedModelRef, SavedOrchestratorDefinition, SavedOrchestratorRecord } from "../types.js"

export interface CreateSavedOrchestratorInput {
    name: string
    models: SavedModelRef[]
    config: Partial<Pick<RueterModelConfig, "systemPrompt" | "temperature" | "maxTokens">>
}

export async function listSavedOrchestrators(cwd = process.cwd(), scope?: CliScope): Promise<SavedOrchestratorRecord[]> {
    const scopes = scope ? [scope] : (["local", "global"] as const)
    const allRecords: SavedOrchestratorRecord[] = []

    for (const currentScope of scopes) {
        const directory = nodePath.join(getScopePathInfo(currentScope, cwd).rootDir, "orchestrators")
        const files = await listJsonFiles(directory)
        for (const filePath of files) {
            const definition = await readJsonFile<SavedOrchestratorDefinition>(filePath)
            assertSavedOrchestratorDefinition(definition, filePath)
            allRecords.push({ scope: currentScope, filePath, definition })
        }
    }

    return allRecords.sort((left, right) => {
        if (left.definition.name === right.definition.name) return left.scope.localeCompare(right.scope)
        return left.definition.name.localeCompare(right.definition.name)
    })
}

export async function resolveSavedOrchestrator(
    name: string,
    cwd = process.cwd(),
    scope?: CliScope
): Promise<SavedOrchestratorRecord> {
    const safeName = sanitizeDefinitionName(name)
    const matches = (await listSavedOrchestrators(cwd, scope)).filter(record => record.definition.name === safeName)

    if (matches.length === 0) throw new CliError(`Saved orchestrator "${safeName}" was not found.`)
    if (!scope && matches.length > 1) {
        throw new CliError(`Saved orchestrator "${safeName}" exists in both local and global scope. Re-run with --scope.`)
    }

    return matches[0]
}

export async function saveSavedOrchestrator(
    input: CreateSavedOrchestratorInput,
    scope: CliScope,
    cwd = process.cwd(),
    force = false
): Promise<SavedOrchestratorRecord> {
    const safeName = sanitizeDefinitionName(input.name)
    await initializeCliConfig(scope, cwd)

    const existing = (await listSavedOrchestrators(cwd, scope)).find(record => record.definition.name === safeName)
    if (existing && !force) {
        throw new CliError(`A saved orchestrator named "${safeName}" already exists in ${scope} scope. Use --force to overwrite it.`)
    }

    if (input.models.length === 0) throw new CliError("An orchestrator must include at least one saved model.")

    const definition: SavedOrchestratorDefinition = {
        version: 1,
        kind: "orchestrator",
        name: safeName,
        models: input.models,
        config: validateOrchestratorConfig(input.config),
        createdAt: existing?.definition.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }

    const filePath = getSavedOrchestratorFilePath(scope, safeName, cwd)
    await writeJsonFile(filePath, definition)
    return { scope, filePath, definition }
}

export async function deleteSavedOrchestrator(name: string, cwd = process.cwd(), scope?: CliScope): Promise<SavedOrchestratorRecord> {
    const record = await resolveSavedOrchestrator(name, cwd, scope)
    await removeFile(record.filePath)
    return record
}

export async function instantiateSavedOrchestrator(record: SavedOrchestratorRecord): Promise<{
    orchestrator: Rueter
    models: SavedModelRecord[]
}> {
    const resolvedRecords = await Promise.all(
        record.definition.models.map(modelRef => resolveSavedModel(modelRef.name, process.cwd(), modelRef.scope))
    )

    const instantiated = await Promise.all(resolvedRecords.map(instantiateSavedModel))
    return {
        orchestrator: new Rueter(instantiated.map(entry => entry.model), record.definition.config ?? {}),
        models: resolvedRecords,
    }
}

export async function buildModelReferenceList(
    names: readonly string[],
    cwd = process.cwd(),
    scopeHint?: CliScope
): Promise<SavedModelRef[]> {
    const references: SavedModelRef[] = []
    for (const name of names) {
        const [scopePrefix, rawName] = name.includes(":")
            ? (name.split(":", 2) as [string, string])
            : [scopeHint ?? "", name]

        const scope = scopePrefix === "local" || scopePrefix === "global" ? scopePrefix : scopeHint
        const record = await resolveSavedModel(rawName, cwd, scope)
        references.push({
            scope: record.scope,
            name: record.definition.name,
        })
    }
    return references
}

export async function listAddressableModels(cwd = process.cwd()): Promise<Array<{
    id: string
    record: SavedModelRecord
}>> {
    const records = await listSavedModels(cwd)
    return records.map(record => ({
        id: `${record.scope}:${record.definition.name}`,
        record,
    }))
}

function validateOrchestratorConfig(
    config: Partial<Pick<RueterModelConfig, "systemPrompt" | "temperature" | "maxTokens">>
): Partial<Pick<RueterModelConfig, "systemPrompt" | "temperature" | "maxTokens">> {
    const sanitized: Partial<Pick<RueterModelConfig, "systemPrompt" | "temperature" | "maxTokens">> = {}

    if (config.systemPrompt !== undefined && config.systemPrompt.trim().length > 0) {
        sanitized.systemPrompt = config.systemPrompt.trim()
    }

    if (config.temperature !== undefined) {
        if (!Number.isFinite(config.temperature) || config.temperature < 0 || config.temperature > 1) {
            throw new CliError("orchestrator temperature must be between 0 and 1.")
        }
        sanitized.temperature = config.temperature
    }

    if (config.maxTokens !== undefined) {
        if (!Number.isInteger(config.maxTokens) || config.maxTokens <= 0 || config.maxTokens > 100_000) {
            throw new CliError("orchestrator maxTokens must be an integer between 1 and 100000.")
        }
        sanitized.maxTokens = config.maxTokens
    }

    return sanitized
}

function getSavedOrchestratorFilePath(scope: CliScope, name: string, cwd: string): string {
    return nodePath.join(getScopePathInfo(scope, cwd).rootDir, "orchestrators", `${name}.json`)
}

function assertSavedOrchestratorDefinition(value: SavedOrchestratorDefinition, filePath: string): void {
    if (!value || value.kind !== "orchestrator" || typeof value.name !== "string") {
        throw new CliError(`Invalid saved orchestrator definition in "${filePath}".`)
    }
}
