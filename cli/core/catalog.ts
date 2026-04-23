import {
    getProviderModels,
    listProviders,
} from "../../src/catalog/index.js"
import type { ModelInfo, Provider } from "../../src/types.js"

import type { SelectOption } from "../types.js"

export interface IndexedModelInfo extends ModelInfo {
    index: number
    provider: Provider
}

export function getProviders(): Provider[] {
    return listProviders()
}

export function isProvider(value: string): value is Provider {
    return getProviders().includes(value as Provider)
}

export function getIndexedModels(provider: Provider): IndexedModelInfo[] {
    return getProviderModels(provider).map((model, index) => ({
        ...model,
        index,
        provider,
    }))
}

export function getCatalogModelCount(): number {
    return getProviders()
        .map(provider => getProviderModels(provider).length)
        .reduce((total, count) => total + count, 0)
}

export function getProviderSummaries(): Array<{ provider: Provider; count: number }> {
    return getProviders().map(provider => ({
        provider,
        count: getProviderModels(provider).length,
    }))
}

export function getProviderSelectOptions(): SelectOption<Provider | "all">[] {
    return [
        {
            value: "all",
            label: "All providers",
            hint: `Show the full built-in catalog (${getCatalogModelCount()} models total).`,
        },
        ...getProviderSummaries().map(({ provider, count }) => ({
            value: provider,
            label: formatProviderName(provider),
            hint: `${count} built-in model${count === 1 ? "" : "s"}.`,
        })),
    ]
}

export function getModelSelectOptions(provider: Provider): SelectOption<string>[] {
    return getIndexedModels(provider).map(model => ({
        value: String(model.index),
        label: `[${model.index}] ${model.name}`,
        hint: `${model.description} | context ${formatInteger(model.context)} | ${formatPricingHint(model)}`,
    }))
}

export function formatProviderName(provider: Provider): string {
    switch (provider) {
        case "anthropic": return "Anthropic"
        case "openai": return "OpenAI"
        case "gemini": return "Gemini"
        case "grok": return "Grok"
    }
}

function formatInteger(value: number): string {
    return new Intl.NumberFormat("en-US").format(value)
}

function formatPricingHint(model: ModelInfo): string {
    if (model.pricing_available === false) return "pricing n/a"
    return `input $${model.input_cost.toFixed(2)}/M | output $${model.output_cost.toFixed(2)}/M`
}
