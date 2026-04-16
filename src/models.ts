/**
 * Rueter Models Registry
 * Ordered from cheapest (index 0) to most powerful (index 3)
 */

import type { ModelConfig } from './types.js';

export const models: Record<string, ModelConfig[]> = {
    anthropic: [
        {
            name: "claude-haiku-4-5-20251001",
            model: "claude-haiku-4-5-20251001",
            input_cost: 1.00,
            output_cost: 5.00,
            context: 200_000,
            description: "Cheapest & fastest Haiku (lightweight tasks)"
        },
        {
            name: "claude-sonnet-4-5-20250929",
            model: "claude-sonnet-4-5-20250929",
            input_cost: 3.00,
            output_cost: 15.00,
            context: 200_000,
            description: "Balanced Sonnet (200k context)"
        },
        {
            name: "claude-sonnet-4-6",
            model: "claude-sonnet-4-6",
            input_cost: 3.00,
            output_cost: 15.00,
            context: 1_000_000,
            description: "Latest Sonnet (1M context, best price/performance)"
        },
        {
            name: "claude-opus-4-6",
            model: "claude-opus-4-6",
            input_cost: 5.00,
            output_cost: 25.00,
            context: 1_000_000,
            description: "Most powerful flagship (highest reasoning)"
        }
    ],

    openai: [
        {
            name: "gpt-5.4-nano",
            model: "gpt-5.4-nano",
            input_cost: 0.20,
            output_cost: 1.25,
            context: 128_000,
            description: "Cheapest & fastest nano model"
        },
        {
            name: "gpt-5.4-mini",
            model: "gpt-5.4-mini",
            input_cost: 0.75,
            output_cost: 4.50,
            context: 128_000,
            description: "Mid-low mini model (strong for coding)"
        },
        {
            name: "gpt-5.4",
            model: "gpt-5.4",
            input_cost: 2.50,
            output_cost: 15.00,
            context: 128_000,
            description: "Advanced flagship GPT"
        },
        {
            name: "o3",
            model: "o3",
            input_cost: 2.00,
            output_cost: 8.00,
            context: 200_000,
            description: "Most powerful reasoning model (o-series)"
        }
    ],

    gemini: [
        {
            name: "gemini-2.5-flash-lite",
            model: "gemini-2.5-flash-lite",
            input_cost: 0.10,
            output_cost: 0.40,
            context: 1_000_000,
            description: "Cheapest & lightest Flash-Lite"
        },
        {
            name: "gemini-2.5-flash",
            model: "gemini-2.5-flash",
            input_cost: 0.30,
            output_cost: 2.50,
            context: 1_000_000,
            description: "Mid-low Flash (good speed + capability)"
        },
        {
            name: "gemini-2.5-pro",
            model: "gemini-2.5-pro",
            input_cost: 1.25,
            output_cost: 10.00,
            context: 1_000_000,
            description: "Advanced Pro model"
        },
        {
            name: "gemini-2.5-pro",
            model: "gemini-2.5-pro",
            input_cost: 1.25,
            output_cost: 10.00,
            context: 1_000_000,
            description: "Most powerful reasoning Pro model"
        }
    ],

    grok: [
        {
            name: "grok-4-1-fast-non-reasoning",
            model: "grok-4-1-fast-non-reasoning",
            input_cost: 0.20,
            output_cost: 0.50,
            context: 2_000_000,
            description: "Cheapest & fastest Grok (light tasks)"
        },
        {
            name: "grok-4-1-fast-reasoning",
            model: "grok-4-1-fast-reasoning",
            input_cost: 0.20,
            output_cost: 0.50,
            context: 2_000_000,
            description: "Mid-low fast reasoning model (excellent value)"
        },
        {
            name: "grok-4-fast-reasoning",
            model: "grok-4-fast-reasoning",
            input_cost: 2.00,
            output_cost: 6.00,
            context: 2_000_000,
            description: "Advanced Grok 4 series"
        },
        {
            name: "grok-4.20-reasoning",
            model: "grok-4.20-reasoning",
            input_cost: 2.00,
            output_cost: 6.00,
            context: 2_000_000,
            description: "Most powerful flagship Grok (highest reasoning)"
        }
    ]
} as const;

export type Provider = keyof typeof models;

// Helper function
export function getModel(provider: Provider, tier: number = 0): ModelConfig {
    const modelList = models[provider];
    if (!modelList) throw new Error(`Provider "${provider}" not found`);
    if (tier < 0 || tier >= modelList.length) {
        throw new Error(`Invalid tier ${tier} for provider "${provider}"`);
    }
    return modelList[tier];
}

export default models;