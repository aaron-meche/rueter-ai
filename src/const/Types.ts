//
// Types
//
// Rueter AI
// created by Aaron Meche
//

export type Provider = "anthropic" | "openai" | "gemini" | "grok"

// Model-Specific Configuration
export interface ModelInfo {
    name: string
    input_cost: number
    output_cost: number
    context: number
    description: string
}
export type Models = Record<Provider, ModelInfo[]>

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
    topP?: number
    topK?: number
    frequencyPenalty?: number
    presencePenalty?: number
    stopSequences?: string[]
    n?: number
}
export type BuilderFn = (config: BuilderConfig, prompt: string) => HttpRequestFormat
export type Builders = Record<Provider, BuilderFn>

// ----------------------
// Per-API-Response Items
// ----------------------
// Cost Breakdown
export interface UsageCost {
    model: string
    input: string
    output: string
    total: string
}
// Single Model Result
export interface ModelResult {
    res: string | null
    cost: UsageCost | null
    error?: string
}
// -----------------------------
// Multi-Model (Orchestra) Items
// -----------------------------
// Orchestra Configuration
export interface RueterModelConfig {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
    n?: number;
}
// Prompt Results
export type RueterResults = Record<string, ModelResult>