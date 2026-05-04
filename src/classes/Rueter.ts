//
// Rueter
//
// Rueter AI
// created by Aaron Meche
//
// Orchestrator Class for multiple RueterModels
//

import type {
    ModelResult,
    ModelSelector,
    Provider,
    RueterModelConfig,
    RueterResults,
} from "../types.js"
import { RueterModel } from "./RueterModel.js"

//
// class: Rueter
//
// Multi-model orchestrator for managing multiple "RueterModel" instances
// and prompting them simultaneously.
//
// --> accepts existing "RueterModel" instances or builds new ones inline
// --> can apply shared config updates across every managed model
// --> prompts all managed models concurrently
// --> one failed model does not fail the entire orchestration
// --> duplicate model IDs are suffixed to avoid result collisions
//
// Examples of Class Instantiation
//      - new Rueter()
//      - new Rueter([modelA, modelB])
//      - new Rueter([modelA, modelB], { temperature: 0.2 })
export class Rueter {
    // Internal list of managed model instances
    #models: RueterModel[] = []

    // Constructor:
    //      - optional: pre-built "RueterModel" instances
    //      - optional: shared config to apply to every managed model
    constructor(models: RueterModel[] = [], config: RueterModelConfig = {}) {
        if (!Array.isArray(models)) {
            throw new Error("models must be an array of RueterModel instances.")
        }

        this.addModels(models)

        if (Object.keys(config).length > 0) {
            this.updateConfig(currentConfig => {
                Object.assign(currentConfig, config)
            })
        }
    }

    // Method Overload 1: add existing "RueterModel" instance
    addModel(model: RueterModel): RueterModel
    // Method Overload 2: build model inline with (provider, apiKey, model, config)
    addModel(provider: Provider, apiKey: string, model?: ModelSelector, config?: RueterModelConfig): RueterModel
    // Method Overload 3: build model inline with (provider, apiKey, config)
    addModel(provider: Provider, apiKey: string, config?: RueterModelConfig): RueterModel
    addModel(
        modelOrProvider: RueterModel | Provider,
        apiKey?: string,
        modelOrConfig: ModelSelector | RueterModelConfig = 0,
        config?: RueterModelConfig
    ): RueterModel {
        if (modelOrProvider instanceof RueterModel) {
            this.#models.push(modelOrProvider)
            return modelOrProvider
        }

        if (typeof modelOrProvider !== "string") {
            throw new Error("addModel requires a RueterModel instance or a provider string.")
        }

        if (typeof apiKey !== "string") {
            throw new Error("apiKey must be provided when adding a model by provider.")
        }

        const model = (typeof modelOrConfig === "number" || typeof modelOrConfig === "string")
            ? new RueterModel(modelOrProvider, apiKey, modelOrConfig, config)
            : new RueterModel(modelOrProvider, apiKey, modelOrConfig)

        this.#models.push(model)
        return model
    }

    // Adds many pre-built models at once.
    addModels(models: RueterModel[]): RueterModel[] {
        if (!Array.isArray(models)) {
            throw new Error("models must be an array of RueterModel instances.")
        }

        models.forEach(model => {
            if (!(model instanceof RueterModel)) {
                throw new Error("addModels only accepts RueterModel instances.")
            }
            this.#models.push(model)
        })

        return this.getModels()
    }

    // Removes the first matching model by instance or by string ID.
    //
    // If multiple models share the same base ID, only the first match is removed.
    removeModel(modelOrID: RueterModel | string): boolean {
        const modelIndex = typeof modelOrID === "string"
            ? this.#models.findIndex(model => model.getID() === modelOrID)
            : this.#models.indexOf(modelOrID)

        if (modelIndex === -1) {
            return false
        }

        this.#models.splice(modelIndex, 1)
        return true
    }

    // Removes all managed models from the orchestrator.
    clearModels(): void {
        this.#models = []
    }

    // Returns a shallow copy so outside code cannot mutate the private array directly.
    getModels(): RueterModel[] {
        return [...this.#models]
    }

    // Returns the current model IDs in insertion order.
    getModelIDs(): string[] {
        return this.#models.map(model => model.getID())
    }

    // Returns the number of managed models.
    getSize(): number {
        return this.#models.length
    }

    // Sends one prompt to every managed model concurrently.
    //
    // Return Shape:
    //      - object keyed by model ID
    //      - each entry contains plaintext response or error details
    //      - "cost" is always null in this method
    //
    // Important:
    //      - duplicate model IDs are automatically renamed with "_2", "_3", etc.
    //      - failed requests are captured per model instead of throwing for the whole batch
    async prompt(prompt: string): Promise<RueterResults> {
        return await this.#promptAll(prompt, false)
    }

    // Sends one prompt to every managed model concurrently and includes
    // the per-request cost data when available from each model.
    async promptJSON(prompt: string): Promise<RueterResults> {
        return await this.#promptAll(prompt, true)
    }

    // Updates every managed model using the same mutable config callback pattern
    // used by "RueterModel.updateConfig()".
    //
    // Example:
    //      rueter.updateConfig(config => {
    //          config.temperature = 0.2
    //          config.systemPrompt = "Be concise"
    //      })
    updateConfig(mutator: (config: RueterModelConfig) => void): void {
        if (typeof mutator !== "function") {
            throw new Error("updateConfig requires a callback function.")
        }

        this.#models.forEach(model => model.updateConfig(mutator))
    }

    // Internal batch prompt runner used by both "prompt()" and "promptJSON()".
    //
    // Behavior:
    //      1. assign unique result IDs in insertion order
    //      2. prompt all models concurrently
    //      3. preserve result ordering based on the original model array
    //      4. capture per-model failures without interrupting other models
    async #promptAll(prompt: string, includeCost: boolean): Promise<RueterResults> {
        if (typeof prompt !== "string") {
            throw new Error("prompt must be a string.")
        }

        if (this.#models.length === 0) {
            return {}
        }

        const modelEntries = this.#buildPromptEntries()
        const settledResults = await Promise.all(
            modelEntries.map(async ({ id, model }) => {
                try {
                    const result = includeCost
                        ? await model.promptJSON(prompt)
                        : { res: await model.prompt(prompt), cost: null }

                    return [id, result] as const
                } catch (error) {
                    return [id, this.#createErrorResult(error)] as const
                }
            })
        )

        const results: RueterResults = {}
        settledResults.forEach(([id, result]) => {
            results[id] = result
        })

        return results
    }

    // Builds stable result IDs for a prompt batch.
    //
    // If the same model ID appears multiple times, suffix it so results do not
    // overwrite each other inside the returned object.
    #buildPromptEntries(): Array<{ id: string, model: RueterModel }> {
        const idCounts = new Map<string, number>()

        return this.#models.map(model => {
            const baseID = model.getID()
            const nextCount = (idCounts.get(baseID) ?? 0) + 1
            idCounts.set(baseID, nextCount)

            return {
                id: nextCount === 1 ? baseID : `${baseID}_${nextCount}`,
                model,
            }
        })
    }

    // Normalizes thrown values into a consistent result object.
    #createErrorResult(error: unknown): ModelResult {
        return {
            res: null,
            cost: null,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}
