import type { ModelResult, Provider, RueterModelConfig, RueterResults } from "../src/const/Types.js"

export type CliFlagValue = boolean | string | undefined
export type CliFlags = Record<string, CliFlagValue>
export type CliScope = "local" | "global"

export interface CliOptionHelp {
    flag: string
    description: string
}

export interface CommandContext {
    args: string[]
    flags: CliFlags
    rawArgv: string[]
    interactive: boolean
    cwd: string
}

export interface CommandDefinition {
    path: readonly string[]
    summary: string
    description?: string
    usage?: string
    options?: readonly CliOptionHelp[]
    examples?: readonly string[]
    run(context: CommandContext): Promise<number | void>
}

export interface SelectOption<T extends string> {
    value: T
    label: string
    hint?: string
}

export interface MultiSelectOption<T extends string> extends SelectOption<T> {
    selected?: boolean
}

export interface CliConfigFile {
    version: number
    defaults: {
        outputFormat: "pretty"
        interactive: true
    }
    createdAt: string
    updatedAt: string
}

export interface SavedModelDefinition {
    version: 1
    kind: "model"
    name: string
    provider: Provider
    modelName: string
    modelIndex: number
    apiKeyEnv: string
    config: RueterModelConfig
    createdAt: string
    updatedAt: string
}

export interface SavedModelRecord {
    scope: CliScope
    filePath: string
    definition: SavedModelDefinition
}

export interface SavedModelRef {
    scope: CliScope
    name: string
}

export interface SavedOrchestratorDefinition {
    version: 1
    kind: "orchestrator"
    name: string
    models: SavedModelRef[]
    config: Pick<RueterModelConfig, "systemPrompt" | "temperature" | "maxTokens">
    createdAt: string
    updatedAt: string
}

export interface SavedOrchestratorRecord {
    scope: CliScope
    filePath: string
    definition: SavedOrchestratorDefinition
}

export interface ModelExecutionResult {
    name: string
    provider: Provider
    modelName: string
    prompt: string
    durationMs: number
    result: ModelResult
}

export interface OrchestratorExecutionResult {
    name: string
    prompt: string
    durationMs: number
    result: RueterResults
}

export type HistoryTargetType = "model" | "orchestrator" | "preset" | "workflow" | "ghostwriter" | "ask"

export interface HistoryEntry {
    version: 1
    id: string
    command: string[]
    target: {
        type: HistoryTargetType
        name: string
        provider?: Provider
        modelName?: string
    }
    prompt?: string
    durationMs?: number
    result?: unknown
    cwd: string
    createdAt: string
}

export interface HistoryRecord {
    scope: CliScope
    filePath: string
    entry: HistoryEntry
}

export type ParsedInvocation =
    | { kind: "command"; command: CommandDefinition; context: CommandContext }
    | { kind: "help"; command?: CommandDefinition; error?: string }
    | { kind: "version" }
