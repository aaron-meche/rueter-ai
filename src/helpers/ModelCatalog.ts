//
// Model Catalog
//
// Rueter AI
// created by Aaron Meche
//
// Small public helpers for inspecting the built-in provider/model catalog.
//

import { models } from "../models/Catalog.js"
import type { ModelInfo, Provider } from "../types.js"

export const providerModelCatalog = models

export function listProviders(): Provider[] {
    return Object.keys(models) as Provider[]
}

export function getProviderModels(provider: Provider): readonly ModelInfo[] {
    return models[provider]
}

export function getModelByIndex(provider: Provider, modelIndex: number): ModelInfo | undefined {
    return models[provider][modelIndex]
}

export function getModelByName(provider: Provider, modelName: string): ModelInfo | undefined {
    return models[provider].find(model => model.name === modelName)
}

export function getModelIndexByName(provider: Provider, modelName: string): number {
    return models[provider].findIndex(model => model.name === modelName)
}
