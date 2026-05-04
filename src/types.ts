//
// Types
//
// Rueter AI
// created by Aaron Meche
//

export type Provider = "anthropic" | "openai" | "gemini" | "grok" | "deepseek"
export type ModelSelector = number | string

export interface ModelInfo {
    name: string
    display_name: string
    input_cost: number
    output_cost: number
}
export type ModelCatalogEntry = Omit<ModelInfo, "name">
export type Models = Record<Provider, Record<string, ModelCatalogEntry>>

// Provider-specific HTTP Request Formatting Builders
export interface HttpRequestFormat {
    url: string
    method: string
    headers: Record<string, string>
    body: object
}
export interface BuilderConfig {
    apiKey: string
    modelName: string
    maxTokens: number
    temperature: number
    systemPrompt: string
    stopSequences?: string[]
}
export type BuilderFn = (config: BuilderConfig, prompt: string) => HttpRequestFormat
export type Builders = Record<Provider, BuilderFn>

// -----------------------------
// Multi-Model (Orchestra) Items
// -----------------------------
// Orchestra Configuration
export interface RueterModelConfig {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
}

export interface NormalizedRueterModelConfig {
    systemPrompt: string
    temperature: number
    maxTokens: number
    stopSequences?: string[]
}
// Prompt Results
export type RueterResults = Record<string, ModelResult>

// ----------------------
// Per-API-Response Items
// ----------------------
// Single Model Result
export interface ModelResult {
    res: string | null
    cost: UsageCost | null
    error?: string
}
// Cost Breakdown
export interface UsageCost {
    model: string
    input: string
    output: string
    total: string
}
