//
// Model Catalog
//
// Rueter AI
// created by Aaron Meche
//
// Small public helpers for inspecting the built-in provider/model catalog.
//

import { providerModels } from "./providerModels.js"
import type { ModelInfo, Provider } from "../types.js"

export { providerModels }

export const providerModelCatalog = providerModels

export function listProviders(): Provider[] {
    return Object.keys(providerModels) as Provider[]
}

export function getProviderModels(provider: Provider): readonly ModelInfo[] {
    return providerModels[provider]
}

export function getModelByIndex(provider: Provider, modelIndex: number): ModelInfo | undefined {
    return providerModels[provider][modelIndex]
}

export function getModelByName(provider: Provider, modelName: string): ModelInfo | undefined {
    return providerModels[provider].find(model => model.name === modelName)
}

export function getModelIndexByName(provider: Provider, modelName: string): number {
    return providerModels[provider].findIndex(model => model.name === modelName)
}
