//
// Rueter Model
//
// Rueter AI
// created by Aaron Meche
//
// Individual AI Model for single instances
//

import type {
    ModelInfo,
    HttpRequestFormat,
    ModelResult,
    ModelSelector,
    NormalizedRueterModelConfig,
    Provider,
    RueterModelConfig,
} from "../types.js"
import { requestBuilders } from "../builders.js"
import { calculateUsageCost } from "../costs.js"
import { models } from "../models.js"

const DEFAULT_SYSTEM_PROMPT = ""
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 1024

export class RueterModel {
    #provider: Provider
    #model: ModelInfo
    #apiKey: string
    #config: NormalizedRueterModelConfig

    constructor(provider: Provider, apiKey: string, model?: ModelSelector, config?: RueterModelConfig)
    constructor(provider: Provider, apiKey: string, config?: RueterModelConfig)
    constructor(provider: Provider, apiKey: string, modelOrConfig: ModelSelector | RueterModelConfig = 0, config?: RueterModelConfig) {
        // default model = 0
        let modelSelector: ModelSelector = 0
        let resolvedConfig: RueterModelConfig | undefined = config

        // The third argument can be either a model selector or a config object.
        if (typeof modelOrConfig === "number" || typeof modelOrConfig === "string") {
            modelSelector = modelOrConfig
        } else {
            resolvedConfig = modelOrConfig
        }

        // Convert the selector into the exact built-in catalog model for this provider.
        this.#provider = provider
        this.#apiKey = apiKey
        this.#model = resolveModelSelection(provider, modelSelector)

        // Apply defaults without provider-specific config validation.
        this.#config = createRueterModelConfig(resolvedConfig)
    }

    async #httpRequest(builder: HttpRequestFormat): Promise<Record<string, unknown>> {
        const options: RequestInit = {
            method: builder.method,
            headers: {
                "Content-Type": "application/json",
                ...builder.headers
            },
            body: JSON.stringify(builder.body)
        }
        const response = await fetch(builder.url, options)
        if (!response.ok) {
            let body = ""
            try { body = await response.text() } catch { /* ignore */ }
            throw new Error(
                `[${this.#provider}] HTTP ${response.status} - ${response.statusText}` +
                (body ? `\n${body}` : "")
            )
        }
        return await response.json() as Record<string, unknown>
    }

    async prompt(prompt: string): Promise<string> {
        // 1. merge config
        const config = {
            apiKey: this.#apiKey,
            modelName: this.#model.name,
            ...this.#config,
        }

        // 2. build provider-specific HTTP request
        const res = await this.#httpRequest(requestBuilders[this.#provider](config, prompt))

        // 3. extract provider response text
        const responseText =
            (res.choices as any)?.[0]?.message?.content ??
            (res.content as any)?.[0]?.text ??
            (res.candidates as any)?.[0]?.content?.parts?.[0]?.text ??
            (res.output_text as string | undefined) ??
            JSON.stringify(res)

        return responseText
    }

    async promptJSON(prompt: string): Promise<ModelResult> {
        // 1. merge config
        const config = {
            apiKey: this.#apiKey,
            modelName: this.#model.name,
            ...this.#config,
        }

        // 2. build provider-specific HTTP request
        const res = await this.#httpRequest(requestBuilders[this.#provider](config, prompt))

        // 3. extract provider response text
        const responseText =
            (res.choices as any)?.[0]?.message?.content ??
            (res.content as any)?.[0]?.text ??
            (res.candidates as any)?.[0]?.content?.parts?.[0]?.text ??
            (res.output_text as string | undefined) ??
            JSON.stringify(res)

        // 4. calculate cost details for this API call
        return {
            res: responseText,
            cost: calculateUsageCost(res, this.#model)
        }
    }

    updateConfig(mutator: (config: RueterModelConfig) => void): void {
        const nextConfig: RueterModelConfig = { ...this.#config }
        mutator(nextConfig)
        this.#config = createRueterModelConfig(nextConfig)
    }

    getID(): string {
        return `${this.#provider}_${this.#model.name}`
    }
}

// ----------------
// Helper Functions
// ----------------
function resolveModelSelection(provider: Provider, selector: ModelSelector = 0): ModelInfo {
    const providerModels = models[provider]
    const entries = Object.entries(providerModels)

    // Handle Integer Index
    if (typeof selector === "number") {
        const model = entries[selector]
        if (!model) throw new Error(`Provider "${provider}" does not have a model at index ${selector}.`)
        return { name: model[0], ...model[1] }
    }
    // Handle Model Name String
    const normalizedSelector = normalizeModelKey(selector)
    const model = entries.find(([name, info]) => {
        return normalizeModelKey(name) === normalizedSelector || normalizeModelKey(info.display_name) === normalizedSelector
    })

    if (!model) throw new Error(`Provider "${provider}" does not have a model named "${selector}".`)
    return { name: model[0], ...model[1] }
}

function createRueterModelConfig(config: RueterModelConfig = {}): NormalizedRueterModelConfig {
    return {
        systemPrompt: config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        temperature: config.temperature ?? DEFAULT_TEMPERATURE,
        maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
        stopSequences: config.stopSequences,
    }
}

function normalizeModelKey(value: string): string {
    return value.trim().toLowerCase().replace(/[\s_-]+/g, "")
}
