//
// Model Catalog
//
// Rueter AI
// created by Aaron Meche
//
// Small public helpers for inspecting the built-in provider/model catalog.
//

import { providerModels } from "./providerModels.js"
import type { ModelInfo, ModelSelector, Provider } from "../types.js"

export interface CatalogModelResolution {
    index: number
    model: ModelInfo
}

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
    const index = findModelIndex(provider, modelName)
    return index >= 0 ? providerModels[provider][index] : undefined
}

export function getModelIndexByName(provider: Provider, modelName: string): number {
    return findModelIndex(provider, modelName)
}

export function resolveCatalogModel(provider: Provider, selector: ModelSelector = 0): CatalogModelResolution {
    if (typeof selector === "number") {
        if (!Number.isInteger(selector) || selector < 0) {
            throw new Error("model selector index must be a non-negative integer.")
        }

        const model = getModelByIndex(provider, selector)
        if (!model) {
            throw new Error(`Provider "${provider}" does not have a built-in model at index ${selector}.`)
        }

        return { index: selector, model }
    }

    const normalizedName = selector.trim()
    if (normalizedName.length === 0) {
        throw new Error("model selector name must be a non-empty string.")
    }

    const index = findModelIndex(provider, normalizedName)
    if (index < 0) {
        throw new Error(`Provider "${provider}" does not have a built-in model named "${normalizedName}".`)
    }

    return {
        index,
        model: providerModels[provider][index],
    }
}

function findModelIndex(provider: Provider, modelName: string): number {
    const normalizedName = normalizeCatalogKey(modelName)
    if (normalizedName.length === 0) return -1

    return providerModels[provider].findIndex(model => {
        const candidateKeys = [
            model.name,
            model.display_name,
            ...(model.aliases ?? []),
        ]

        return candidateKeys.some(candidate => {
            const candidateKey = normalizeCatalogKey(candidate)
            return candidateKey === normalizedName || collapseCatalogKey(candidateKey) === collapseCatalogKey(normalizedName)
        })
    })
}

function normalizeCatalogKey(value: string): string {
    return value.trim().toLowerCase()
}

function collapseCatalogKey(value: string): string {
    return value.replace(/[\s_-]+/g, "")
}
