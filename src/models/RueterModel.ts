//
// Rueter Model
//
// Rueter AI
// created by Aaron Meche
//
// Individual AI Model for single instances
//

import type { Provider, ModelInfo, ModelResult, HttpRequestFormat, RueterModelConfig } from "../types.js"
import { models } from "./Catalog.js"
import { builders } from "../helpers/Builders.js"
import { calculateUsageCost } from "../helpers/CostCalculator.js"

export class RueterModel {
    // Model Type Config
    #provider: Provider
    #model: ModelInfo
    #apiKey: string
    // Behavior Config
    #systemPrompt: string = ""
    #temperature: number = 0.7
    #maxTokens: number = 1024
    #topP?: number
    #topK?: number
    #frequencyPenalty?: number
    #presencePenalty?: number
    #stopSequences?: string[]
    #n?: number

    constructor(provider: Provider, apiKey: string, model: number = 0, config?: RueterModelConfig) {
        this.#provider = provider
        this.#apiKey = apiKey
        this.#model = models[provider][model]
        if (config?.systemPrompt) this.#systemPrompt = config.systemPrompt
        if (config?.temperature !== undefined) this.#temperature = config.temperature
        if (config?.maxTokens) this.#maxTokens = config.maxTokens
        if (config?.topP !== undefined) this.#topP = config.topP
        if (config?.topK !== undefined) this.#topK = config.topK
        if (config?.frequencyPenalty !== undefined) this.#frequencyPenalty = config.frequencyPenalty
        if (config?.presencePenalty !== undefined) this.#presencePenalty = config.presencePenalty
        if (config?.stopSequences !== undefined) this.#stopSequences = config.stopSequences
        if (config?.n !== undefined) this.#n = config.n
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

    async prompt(prompt: string, returnJSON: true): Promise<ModelResult>
    async prompt(prompt: string, returnJSON?: false): Promise<string>
    async prompt(prompt: string, returnJSON?: boolean): Promise<ModelResult | string> {
        const config = {
            apiKey: this.#apiKey,
            modelName: this.#model.name,
            maxTokens: this.#maxTokens,
            temperature: this.#temperature,
            systemPrompt: this.#systemPrompt,
            topP: this.#topP,
            topK: this.#topK,
            frequencyPenalty: this.#frequencyPenalty,
            presencePenalty: this.#presencePenalty,
            stopSequences: this.#stopSequences,
            n: this.#n,
        }
        const res = await this.#httpRequest(builders[this.#provider](config, prompt))
        const responseText =
            (res.choices as any)?.[0]?.message?.content ??
            (res.content as any)?.[0]?.text ??
            (res.candidates as any)?.[0]?.content?.parts?.[0]?.text ??
            (res.output_text as string | undefined) ??
            JSON.stringify(res)
        // Include Cost Information
        if (returnJSON) {
            return { res: responseText, cost: calculateUsageCost(res, this.#model) }
        }
        // Standard, Plaintext Response
        else {
            return responseText
        }
    }

    setSystemPrompt(sysPrompt: string): void {
        if (typeof sysPrompt !== "string" || sysPrompt.trim().length === 0) return
        this.#systemPrompt = sysPrompt.trim()
    }

    setTemperature(temp: number): void {
        if (!Number.isFinite(temp) || temp < 0 || temp > 1) return
        this.#temperature = temp
    }

    setMaxTokens(maxTok: number): void {
        if (!Number.isInteger(maxTok) || maxTok <= 0 || maxTok > 100_000) return
        this.#maxTokens = maxTok
    }

    getID(): string {
        return `${this.#provider}_${this.#model.name}`
    }
}