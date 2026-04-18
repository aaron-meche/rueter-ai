//
// RueterModel.ts
//
// Rueter AI
// created by Aaron Meche
//
// Individual AI Model for single instances
//

import type { Provider, ModelInfo, ModelResult, HttpRequestFormat, RueterModelConfig } from "./types.js"
import { models } from "./models.js"
import { builders } from "./builders.js"
import { calculateUsageCost } from "./calculateUsageCost.js"

export class RueterModel {
    // Model Type Config
    #provider: Provider
    #model: ModelInfo
    #apiKey: string
    // Behavior Config
    #systemPrompt: string = ""
    #temperature: number = 0.7
    #maxTokens: number = 1024

    constructor(provider: Provider, apiKey: string, model: number = 0, config?: RueterModelConfig) {
        this.#provider = provider
        this.#apiKey = apiKey
        this.#model = models[provider][model]
        if (config?.systemPrompt) this.#systemPrompt = config.systemPrompt
        if (config?.temperature) this.#temperature = config.temperature
        if (config?.maxTokens) this.#maxTokens = config.maxTokens
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
            throw new Error(`[${this.#provider}] HTTP ${response.status} - ${response.statusText}`)
        }
        return await response.json() as Record<string, unknown>
    }

    async prompt(prompt: string, returnJustText?: boolean): Promise<ModelResult> {
        const config = {
            apiKey: this.#apiKey,
            modelName: this.#model.name,
            maxTokens: this.#maxTokens,
            temperature: this.#temperature,
            systemPrompt: this.#systemPrompt
        }
        const res = await this.#httpRequest(builders[this.#provider](config, prompt))
        const responseText =
            (res.choices as any)?.[0]?.message?.content ??
            (res.content as any)?.[0]?.text ??
            (res.candidates as any)?.[0]?.content?.parts?.[0]?.text ??
            (res.output_text as string | undefined) ??
            JSON.stringify(res)
        if (returnJustText) return responseText
        return { res: responseText, cost: calculateUsageCost(res, this.#model) }
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