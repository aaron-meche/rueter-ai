//
// models.js
//
// created by Aaron Meche
// 
// This file contains an "models" object that
// details the different models offered by
// rueter-ai. Each company object contains an
// array of model objects that contain cost
// information along with the model name
//
// Each company array that contains models
// is formatted in the following manner:
//
// index 0: cheapest, lowest reasoning
// index 1: slighly more advanced
// index 2: even more advanced
// index 3: most advanced / expensive
//

export const models = {
    "anthropic": [
        {
            name: "claude-haiku-4-5-20251001",
            input_cost: 1.00,
            output_cost: 5.00,
            context: 200000,
            description: "Cheapest & fastest Haiku (lightweight tasks)"
        },
        {
            name: "claude-sonnet-4-5-20250929",
            input_cost: 3.00,
            output_cost: 15.00,
            context: 200000,
            description: "Balanced Sonnet (200k context)"
        },
        {
            name: "claude-sonnet-4-6",
            input_cost: 3.00,
            output_cost: 15.00,
            context: 1000000,
            description: "Latest Sonnet (1M context, best price/performance)"
        },
        {
            name: "claude-opus-4-6",
            input_cost: 5.00,
            output_cost: 25.00,
            context: 1000000,
            description: "Most powerful flagship (highest reasoning)"
        }
    ],
    "openai": [
        {
            name: "gpt-5.4-nano",
            input_cost: 0.20,
            output_cost: 1.25,
            context: 128000,
            description: "Cheapest & fastest nano model"
        },
        {
            name: "gpt-5.4-mini",
            input_cost: 0.75,
            output_cost: 4.50,
            context: 128000,
            description: "Mid-low mini model (strong for coding/subagents)"
        },
        {
            name: "gpt-5.4",
            input_cost: 2.50,
            output_cost: 15.00,
            context: 128000,
            description: "Advanced flagship GPT"
        },
        {
            name: "o3", // or gpt-5.4-pro / o3-pro depending on your needs
            input_cost: 2.00,   // approximate for o3; adjust if using pro variant
            output_cost: 8.00,
            context: 200000,
            description: "Most powerful reasoning model (o-series)"
        }
    ],
    "gemini": [
        {
            name: "gemini-2.5-flash-lite",
            input_cost: 0.10,
            output_cost: 0.40,
            context: 1000000,
            description: "Cheapest & lightest Flash-Lite"
        },
        {
            name: "gemini-2.5-flash",
            input_cost: 0.30,
            output_cost: 2.50,
            context: 1000000,
            description: "Mid-low Flash (good speed + capability)"
        },
        {
            name: "gemini-2.5-pro",
            input_cost: 1.25,   // ≤200K context
            output_cost: 10.00,
            context: 1000000,
            description: "Advanced Pro model"
        },
        {
            name: "gemini-2.5-pro", // or gemini-3-pro / 3.1-pro if newer
            input_cost: 1.25,   // or higher for extended context
            output_cost: 10.00,
            context: 1000000,
            description: "Most powerful reasoning Pro model"
        }
    ],
    "grok": [
        {
            name: "grok-4-1-fast-non-reasoning",   // or grok-4-1-fast-reasoning if you prefer reasoning
            input_cost: 0.20,
            output_cost: 0.50,
            context: 2000000,
            description: "Cheapest & fastest Grok (light tasks, lowest reasoning)"
        },
        {
            name: "grok-4-1-fast-reasoning",
            input_cost: 0.20,
            output_cost: 0.50,
            context: 2000000,
            description: "Mid-low fast reasoning model (excellent value)"
        },
        {
            name: "grok-4-fast-reasoning",   // or grok-4.20-non-reasoning
            input_cost: 2.00,
            output_cost: 6.00,
            context: 2000000,
            description: "Advanced Grok 4 series"
        },
        {
            name: "grok-4.20-reasoning",     // or grok-4 / grok-4-0709
            input_cost: 2.00,                 // some sources show $3/$15 for pure grok-4
            output_cost: 6.00,
            context: 2000000,
            description: "Most powerful flagship Grok (highest reasoning)"
        }
    ]
}