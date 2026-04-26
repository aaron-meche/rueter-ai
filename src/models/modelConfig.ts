//
// Model Config
//
// Rueter AI
// created by Aaron Meche
//

import { resolveCatalogModel } from "../catalog/index.js"
import type {
    ModelInfo,
    ModelSelector,
    NormalizedRueterModelConfig,
    Provider,
    RueterModelConfig,
} from "../types.js"

export interface ResolvedModelSelection {
    index: number
    model: ModelInfo
}

type ConfigField = keyof RueterModelConfig
type ConfigSupport = Record<ConfigField, boolean>

const DEFAULT_SYSTEM_PROMPT = ""
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 1024
const MAX_FALLBACK_TOKENS = 100_000
const MAX_N = 100

const ANTHROPIC_CONFIG_SUPPORT: ConfigSupport = {
    systemPrompt: true,
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: true,
    frequencyPenalty: false,
    presencePenalty: false,
    stopSequences: true,
    n: false,
}

const OPENAI_CONFIG_SUPPORT: ConfigSupport = {
    systemPrompt: true,
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: false,
    frequencyPenalty: true,
    presencePenalty: true,
    stopSequences: true,
    n: true,
}

const GEMINI_CONFIG_SUPPORT: ConfigSupport = {
    systemPrompt: true,
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: true,
    frequencyPenalty: false,
    presencePenalty: false,
    stopSequences: true,
    n: true,
}

const GROK_REASONING_CONFIG_SUPPORT: ConfigSupport = {
    systemPrompt: true,
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: false,
    frequencyPenalty: false,
    presencePenalty: false,
    stopSequences: false,
    n: true,
}

const GROK_NON_REASONING_CONFIG_SUPPORT: ConfigSupport = {
    systemPrompt: true,
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: false,
    frequencyPenalty: true,
    presencePenalty: true,
    stopSequences: true,
    n: true,
}

const DEEPSEEK_CHAT_CONFIG_SUPPORT: ConfigSupport = {
    systemPrompt: true,
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: false,
    frequencyPenalty: true,
    presencePenalty: true,
    stopSequences: true,
    n: false,
}

const DEEPSEEK_REASONER_CONFIG_SUPPORT: ConfigSupport = {
    systemPrompt: true,
    temperature: true,
    maxTokens: true,
    topP: true,
    topK: false,
    frequencyPenalty: false,
    presencePenalty: false,
    stopSequences: true,
    n: false,
}

export function validateApiKey(apiKey: string): string {
    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
        throw new Error("apiKey must be a non-empty string.")
    }

    return apiKey.trim()
}

export function resolveModelSelection(provider: Provider, selector: ModelSelector = 0): ResolvedModelSelection {
    const resolved = resolveCatalogModel(provider, selector)
    return {
        index: resolved.index,
        model: resolved.model,
    }
}

export function normalizeRueterModelConfig(
    provider: Provider,
    model: ModelInfo,
    config: RueterModelConfig = {}
): NormalizedRueterModelConfig {
    const normalized: NormalizedRueterModelConfig = {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        temperature: DEFAULT_TEMPERATURE,
        maxTokens: Math.min(model.max_output_tokens ?? MAX_FALLBACK_TOKENS, DEFAULT_MAX_TOKENS),
    }

    if (config.systemPrompt !== undefined) {
        assertFieldSupported(provider, model, "systemPrompt")
        normalized.systemPrompt = validateSystemPrompt(config.systemPrompt)
    }

    if (config.temperature !== undefined) {
        assertFieldSupported(provider, model, "temperature")
        normalized.temperature = validateTemperature(config.temperature)
    }

    if (config.maxTokens !== undefined) {
        assertFieldSupported(provider, model, "maxTokens")
        normalized.maxTokens = validateMaxTokens(config.maxTokens, model)
    }

    if (config.topP !== undefined) {
        assertFieldSupported(provider, model, "topP")
        normalized.topP = validateUnitInterval(config.topP, "topP")
    }

    if (config.topK !== undefined) {
        assertFieldSupported(provider, model, "topK")
        normalized.topK = validatePositiveInteger(config.topK, "topK")
    }

    if (config.frequencyPenalty !== undefined) {
        assertFieldSupported(provider, model, "frequencyPenalty")
        normalized.frequencyPenalty = validateFiniteNumber(config.frequencyPenalty, "frequencyPenalty")
    }

    if (config.presencePenalty !== undefined) {
        assertFieldSupported(provider, model, "presencePenalty")
        normalized.presencePenalty = validateFiniteNumber(config.presencePenalty, "presencePenalty")
    }

    if (config.stopSequences !== undefined) {
        assertFieldSupported(provider, model, "stopSequences")
        normalized.stopSequences = validateStopSequences(config.stopSequences)
    }

    if (config.n !== undefined) {
        assertFieldSupported(provider, model, "n")
        normalized.n = validateCandidateCount(config.n)
    }

    return normalized
}

export function applyRueterModelConfigPatch(
    provider: Provider,
    model: ModelInfo,
    currentConfig: NormalizedRueterModelConfig,
    patch: RueterModelConfig
): NormalizedRueterModelConfig {
    return normalizeRueterModelConfig(provider, model, {
        ...currentConfig,
        ...patch,
    })
}

export function validateSystemPrompt(value: string): string {
    if (typeof value !== "string") throw new Error("systemPrompt must be a string.")
    return value.trim()
}

export function validateTemperature(value: number): number {
    return validateUnitInterval(value, "temperature")
}

export function validateMaxTokens(value: number, model: ModelInfo): number {
    const maxAllowed = model.max_output_tokens ?? MAX_FALLBACK_TOKENS
    const validated = validatePositiveInteger(value, "maxTokens")

    if (validated > maxAllowed) {
        throw new Error(`maxTokens must be less than or equal to ${maxAllowed} for model "${model.name}".`)
    }

    return validated
}

function assertFieldSupported(
    provider: Provider,
    model: ModelInfo,
    field: ConfigField
): void {
    if (!getConfigSupport(provider, model)[field]) {
        throw new Error(`Model "${model.name}" does not support "${String(field)}".`)
    }
}

function getConfigSupport(provider: Provider, model: ModelInfo): ConfigSupport {
    switch (provider) {
        case "anthropic":
            return ANTHROPIC_CONFIG_SUPPORT
        case "openai":
            return OPENAI_CONFIG_SUPPORT
        case "gemini":
            return GEMINI_CONFIG_SUPPORT
        case "deepseek":
            return model.name.includes("reasoner") || model.name.endsWith("-r1")
                ? DEEPSEEK_REASONER_CONFIG_SUPPORT
                : DEEPSEEK_CHAT_CONFIG_SUPPORT
        case "grok":
            return model.name.includes("non-reasoning")
                ? GROK_NON_REASONING_CONFIG_SUPPORT
                : GROK_REASONING_CONFIG_SUPPORT
    }
}

function validateUnitInterval(value: number, label: string): number {
    const validated = validateFiniteNumber(value, label)
    if (validated < 0 || validated > 1) throw new Error(`${label} must be between 0 and 1.`)
    return validated
}

function validateFiniteNumber(value: number, label: string): number {
    if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`)
    return value
}

function validatePositiveInteger(value: number, label: string): number {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${label} must be a positive integer.`)
    }

    return value
}

function validateStopSequences(value: string[]): string[] {
    if (!Array.isArray(value)) throw new Error("stopSequences must be an array of strings.")

    const sequences = value
        .map(item => {
            if (typeof item !== "string") throw new Error("stopSequences must only contain strings.")
            return item.trim()
        })
        .filter(item => item.length > 0)

    if (sequences.length === 0) {
        throw new Error("stopSequences must include at least one non-empty string when provided.")
    }

    return sequences
}

function validateCandidateCount(value: number): number {
    const validated = validatePositiveInteger(value, "n")
    if (validated > MAX_N) throw new Error(`n must be less than or equal to ${MAX_N}.`)
    return validated
}
