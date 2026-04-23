//
// Types
//
// Rueter AI
// created by Aaron Meche
//

export type Provider = "anthropic" | "openai" | "gemini" | "grok"
export type ModelSelector = number | string
export type ModelStatus = "active" | "preview" | "legacy" | "deprecated" | "retired"
export type ModelReleaseStage = "stable" | "preview" | "experimental" | "deprecated" | "retired"
export type ModelModality = "text" | "image" | "audio" | "video" | "pdf"

export interface ModelConfigSupport {
    system_prompt: boolean
    temperature: boolean
    max_tokens: boolean
    top_p: boolean
    top_k: boolean
    frequency_penalty: boolean
    presence_penalty: boolean
    stop_sequences: boolean
    n: boolean
}

// Model-Specific Configuration
export interface ModelInfo {
    name: string
    display_name: string
    family: string
    input_cost: number
    output_cost: number
    cached_input_cost?: number
    context: number
    max_output_tokens?: number
    knowledge_cutoff?: string
    description: string
    status: ModelStatus
    release_stage: ModelReleaseStage
    aliases?: string[]
    reasoning: boolean
    streaming: boolean
    vision: boolean
    function_calling: boolean
    structured_outputs: boolean
    tool_use: boolean
    prompt_caching: boolean
    input_modalities: ModelModality[]
    output_modalities: ModelModality[]
    supported_endpoints: string[]
    config_support: ModelConfigSupport
    current?: boolean
    recommended?: boolean
    pricing_available?: boolean
    retirement_date?: string
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

export interface NormalizedRueterModelConfig {
    systemPrompt: string
    temperature: number
    maxTokens: number
    topP?: number
    topK?: number
    frequencyPenalty?: number
    presencePenalty?: number
    stopSequences?: string[]
    n?: number
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