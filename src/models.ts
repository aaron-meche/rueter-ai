//
// Model Catalog
//
// Rueter AI
// created by Aaron Meche
//

import type { Models } from "./types.js"

export const models = {
    anthropic: {
        "claude-3-haiku-20240307": {
            display_name: "Claude Haiku 3",
            input_cost: 0.25,
            output_cost: 1.25,
        },
        "claude-3-5-haiku-20241022": {
            display_name: "Claude Haiku 3.5",
            input_cost: 0.8,
            output_cost: 4,
        },
        "claude-haiku-4-5": {
            display_name: "Claude Haiku 4.5",
            input_cost: 1,
            output_cost: 5,
        },
        "claude-sonnet-4-6": {
            display_name: "Claude Sonnet 4.6",
            input_cost: 3,
            output_cost: 15,
        },
        "claude-opus-4-7": {
            display_name: "Claude Opus 4.7",
            input_cost: 5,
            output_cost: 25,
        },
    },
    openai: {
        "gpt-5-nano": {
            display_name: "GPT-5 nano",
            input_cost: 0.05,
            output_cost: 0.4,
        },
        "gpt-5.4-nano": {
            display_name: "GPT-5.4 nano",
            input_cost: 0.2,
            output_cost: 1.25,
        },
        "gpt-5-mini": {
            display_name: "GPT-5 mini",
            input_cost: 0.25,
            output_cost: 2,
        },
        "gpt-5.4-mini": {
            display_name: "GPT-5.4 mini",
            input_cost: 0.75,
            output_cost: 4.5,
        },
        "o4-mini": {
            display_name: "o4-mini",
            input_cost: 1.1,
            output_cost: 4.4,
        },
        "gpt-4.1": {
            display_name: "GPT-4.1",
            input_cost: 2,
            output_cost: 8,
        },
        "o3": {
            display_name: "o3",
            input_cost: 2,
            output_cost: 8,
        },
        "gpt-5.4": {
            display_name: "GPT-5.4",
            input_cost: 2.5,
            output_cost: 15,
        },
        "gpt-5.5": {
            display_name: "GPT-5.5",
            input_cost: 5,
            output_cost: 30,
        },
        "o3-pro": {
            display_name: "o3-pro",
            input_cost: 20,
            output_cost: 80,
        },
        "gpt-5.5-pro": {
            display_name: "GPT-5.5 pro",
            input_cost: 30,
            output_cost: 180,
        },
    },
    gemini: {
        "gemini-2.0-flash-lite": {
            display_name: "Gemini 2.0 Flash-Lite",
            input_cost: 0.075,
            output_cost: 0.3,
        },
        "gemini-2.5-flash-lite": {
            display_name: "Gemini 2.5 Flash-Lite",
            input_cost: 0.1,
            output_cost: 0.4,
        },
        "gemini-2.5-flash": {
            display_name: "Gemini 2.5 Flash",
            input_cost: 0.3,
            output_cost: 2.5,
        },
        "gemini-3-flash-preview": {
            display_name: "Gemini 3 Flash Preview",
            input_cost: 0.5,
            output_cost: 3,
        },
        "gemini-2.5-pro": {
            display_name: "Gemini 2.5 Pro",
            input_cost: 1.25,
            output_cost: 10,
        },
        "gemini-3-pro-preview": {
            display_name: "Gemini 3 Pro Preview",
            input_cost: 2,
            output_cost: 12,
        },
    },
    deepseek: {
        "deepseek-chat": {
            display_name: "DeepSeek Chat",
            input_cost: 0.14,
            output_cost: 0.28,
        },
        "deepseek-reasoner": {
            display_name: "DeepSeek Reasoner",
            input_cost: 0.14,
            output_cost: 0.28,
        },
        "deepseek-v4-pro": {
            display_name: "DeepSeek V4 Pro",
            input_cost: 0.435,
            output_cost: 0.87,
        },
    },
    grok: {
        "grok-4-1-fast-non-reasoning": {
            display_name: "Grok 4.1 Fast Non-Reasoning",
            input_cost: 0.2,
            output_cost: 0.5,
        },
        "grok-4-1-fast-reasoning": {
            display_name: "Grok 4.1 Fast Reasoning",
            input_cost: 0.2,
            output_cost: 0.5,
        },
        "grok-code-fast-1": {
            display_name: "Grok Code Fast 1",
            input_cost: 0.2,
            output_cost: 1.5,
        },
        "grok-4.20-non-reasoning": {
            display_name: "Grok 4.20 Non-Reasoning",
            input_cost: 2,
            output_cost: 6,
        },
        "grok-4.20-reasoning": {
            display_name: "Grok 4.20 Reasoning",
            input_cost: 2,
            output_cost: 6,
        },
        "grok-4.20-multi-agent": {
            display_name: "Grok 4.20 Multi-Agent",
            input_cost: 2,
            output_cost: 6,
        },
    },
} satisfies Models
