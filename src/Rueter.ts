//
// Rueter
//
// Rueter AI
// created by Aaron Meche
//
// Orchastrator Class for multiple RueterModels
//

import type { Provider, RueterModelConfig, RueterResults } from "./Types.js"
import { RueterModel } from "./RueterModel.js"

export class Rueter {
    #models: RueterModel[] = []

    constructor(models: RueterModel[], config: RueterModelConfig) {
        if (models) this.#models = models
        if (config.systemPrompt) this.setSystemPrompt(config.systemPrompt)
        if (config.temperature !== undefined) this.setTemperature(config.temperature)
        if (config.maxTokens !== undefined) this.setMaxTokens(config.maxTokens)
    }

    addModel(provider: Provider, apiKey: string, model: number = 0): void {
        this.#models.push(new RueterModel(provider, apiKey, model))
    }

    async prompt(prompt: string): Promise<RueterResults> {
        const results: RueterResults = {};
        await Promise.all(
            this.#models.map(async (model) => {
                const id = model.getID();
                try {
                    const { res, cost } = await model.prompt(prompt);
                    results[id] = { res, cost };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    console.error(`Error with model ${id}:`, msg);
                    results[id] = { res: null, cost: null, error: msg };
                }
            })
        );
        return results;
    }

    setSystemPrompt(sysPrompt: string): void {
        this.#models.forEach(model => model.setSystemPrompt(sysPrompt))
    }

    setTemperature(temp: number): void {
        this.#models.forEach(model => model.setTemperature(temp))
    }

    setMaxTokens(maxTok: number): void {
        this.#models.forEach(model => model.setMaxTokens(maxTok))
    }
}