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
import {
    normalizeRueterModelConfig,
    resolveModelSelection,
    validateApiKey,
} from "./modelConfig.js"
import { requestBuilders } from "../providers/requestBuilders.js"
import { calculateUsageCost } from "../tracking/costs.js"

//
// class: RueterModel
//
// Single-model wrapper for Rueter's build-in provider catalog
//
// --> model/config validation centralized in "modelConfig.ts"
// --> model lookup accepts two types of inputs:
//      - Integer Index (0 = less advanced, 1 = more advanced...)
//      - String of Model Name
// --> Accepted "provider" strings:
//      - "anthropic"
//      - "openai"
//      - "gemini"
//      - "grok"
// --> Accepted "model" selector forms:
//      - numerical catalog index, e.g. "0"
//      - exact build-in model id, e.g. "gpt-5.4"
//      - formatted display name,  e.g. "GPT-5.4"
// --> Name matching is forgiving about:
//      - Case Sensitivity
//      - Spaces, Hyphens, Underscores
//
// Examples of Class Instantiation
//      - new RueterModel("openai", apiKey)
//      - new RueterModel("openai", apiKey, "gpt-5.4")
//      - new RueterModel("anthropic", apiKey, "claude sonnet 4.6")
//      - new RueterModel("grok", apiKey, { temperature: 0.2 })
export class RueterModel {
    // Model Type Config
    #provider: Provider
    #model: ModelInfo
    #apiKey: string
    #config: NormalizedRueterModelConfig

    // Constructor Overload 1: (provider, apiKey, model, config)
    //      - required: provider
    //      - required: apiKey
    //      - optional: model (integer | string)
    //      - optional: config
    constructor(provider: Provider, apiKey: string, model?: ModelSelector, config?: RueterModelConfig)
    // Constructor Overload 2: (provider, apiKey, config)
    //      - required: provider
    //      - required: apiKey
    //      - optional: config
    constructor(provider: Provider, apiKey: string, config?: RueterModelConfig)
    constructor(
        provider: Provider,
        apiKey: string,
        modelOrConfig: ModelSelector | RueterModelConfig = 0,
        config?: RueterModelConfig
    ) {
        let modelSelector: ModelSelector = 0
        let resolvedConfig: RueterModelConfig | undefined = config

        // The third argument can be either a model selector or a config object.
        if (typeof modelOrConfig === "number" || typeof modelOrConfig === "string") {
            modelSelector = modelOrConfig
        } else {
            resolvedConfig = modelOrConfig
        }

        // Convert the selector into the exact built-in catalog model for this provider.
        const resolvedModel = resolveModelSelection(provider, modelSelector)

        this.#provider = provider
        this.#apiKey = validateApiKey(apiKey)
        this.#model = resolvedModel.model

        // Apply defaults to config and validate entires to model capabilities
        this.#config = normalizeRueterModelConfig(provider, this.#model, resolvedConfig)
    }

    // Low-level HTTP request execution
    //
    // "builder" is produced by "requestBuilders[this.#provider]"
    // and contains provider-specific HTTP Request formatting,
    // such as URL, headers, and body shape.
    //
    // Upon Failure:
    //  --> Throw Error that includes:
    //      - provider name
    //      - HTTP status code / text
    //      - raw response body (when available)
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

    // Sends a prompt to selected model and returns string response
    //
    // Internal Behavior:
    //      1. merge config with current model + apiKey
    //      2. build provider-specific HTTP request (with builder)
    //      3. extract provider response text from HTTP response
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

    // Sends a prompt to selected model and returns structured response object
    //
    // Internal Behavior:
    //      1. merge config with current model + apiKey
    //      2. build provider-specific HTTP request (with builder)
    //      3. extract provider response text from HTTP response
    //      4. calculate cost for this specific API call (if pricing is available)
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

    // Updates the model config through a mutable config callback.
    //
    // The callback receives a copy of the current config, so callers can write:
    //      model.updateConfig(config => {
    //          config.temperature = 0.7
    //          config.maxTokens = 512
    //      })
    //
    // After the callback runs, the updated config is normalized and validated
    // again against the selected model's capabilities.
    updateConfig(mutator: (config: RueterModelConfig) => void): void {
        if (typeof mutator !== "function") {
            throw new Error("updateConfig requires a callback function.")
        }

        const nextConfig: RueterModelConfig = { ...this.#config }
        mutator(nextConfig)
        this.#config = normalizeRueterModelConfig(this.#provider, this.#model, nextConfig)
    }

    /** Stable identifier used when Rueter aggregates multiple model instances together. */
    getID(): string {
        return `${this.#provider}_${this.#model.name}`
    }
}
