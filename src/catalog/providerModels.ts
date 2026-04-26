import type { ModelInfo, Models, Provider } from "../types.js"

// [name, display_name, input_cost, output_cost, description, max_output_tokens?]
type ModelSeed = readonly [
    name: string,
    display_name: string,
    input_cost: number,
    output_cost: number,
    description: string,
    max_output_tokens?: number,
]

const rawModels = {
    anthropic: [
        ["claude-haiku-4-5", "Claude Haiku 4.5", 1, 5, "Current smallest Claude model for fast, high-volume prompting and coding."],
        ["claude-sonnet-4-6", "Claude Sonnet 4.6", 3, 15, "Current default Sonnet model with major gains in coding, computer use, and long-context work."],
        ["claude-opus-4-7", "Claude Opus 4.7", 5, 25, "Current flagship Claude model for the hardest software and knowledge-work tasks."],
        ["claude-opus-4-6", "Claude Opus 4.6", 5, 25, "Previous Claude flagship with 1M-context beta and stronger long-horizon agent work."],
        ["claude-opus-4-5-20251101", "Claude Opus 4.5", 5, 25, "Earlier frontier Opus release with lower pricing than Opus 4.1."],
        ["claude-sonnet-4-5", "Claude Sonnet 4.5", 3, 15, "Earlier Sonnet frontier release still documented as a drop-in upgrade path."],
        ["claude-opus-4-1-20250805", "Claude Opus 4.1", 15, 75, "Legacy Opus 4.1 release still listed in Anthropic's model catalog."],
        ["claude-opus-4-20250514", "Claude Opus 4", 15, 75, "Legacy Claude 4 Opus snapshot retained in Anthropic's model catalog."],
        ["claude-sonnet-4-20250514", "Claude Sonnet 4", 3, 15, "Legacy Claude 4 Sonnet snapshot retained in Anthropic's model catalog."],
        ["claude-3-7-sonnet-20250219", "Claude Sonnet 3.7", 3, 15, "Legacy Claude 3.7 Sonnet hybrid reasoning model."],
        ["claude-3-5-sonnet-20241022", "Claude Sonnet 3.5 (2024-10-22)", 3, 15, "Legacy Claude 3.5 Sonnet v2 snapshot."],
        ["claude-3-5-sonnet-20240620", "Claude Sonnet 3.5 (2024-06-20)", 3, 15, "Original Claude 3.5 Sonnet snapshot."],
        ["claude-3-5-haiku-20241022", "Claude Haiku 3.5", 0.8, 4, "Legacy Claude Haiku 3.5 snapshot."],
        ["claude-3-opus-20240229", "Claude Opus 3", 15, 75, "Legacy Claude 3 Opus snapshot."],
        ["claude-3-haiku-20240307", "Claude Haiku 3", 0.25, 1.25, "Legacy Claude 3 Haiku snapshot."],
    ],
    openai: [
        ["gpt-5.4-nano", "GPT-5.4 nano", 0.2, 1.25, "Cheapest GPT-5.4-class model for simple, high-volume workloads.", 128_000],
        ["gpt-5.4-mini", "GPT-5.4 mini", 0.75, 4.5, "Strong mini GPT model for coding, subagents, and cost-sensitive loops.", 128_000],
        ["gpt-5.5", "GPT-5.5", 5, 30, "Current OpenAI flagship for complex reasoning and coding.", 128_000],
        ["gpt-5.5-pro", "GPT-5.5 pro", 30, 180, "Higher-compute GPT-5.5 variant for the smartest, most precise responses.", 128_000],
        ["gpt-5.4", "GPT-5.4", 2.5, 15, "More affordable frontier GPT model for coding and professional work.", 128_000],
        ["gpt-5.4-pro", "GPT-5.4 pro", 30, 180, "Higher-compute GPT-5.4 variant for harder multi-step work.", 128_000],
        ["gpt-5-nano", "GPT-5 nano", 0.05, 0.4, "Fastest, cheapest GPT-5-family model for classification and summarization.", 128_000],
        ["gpt-5-mini", "GPT-5 mini", 0.25, 2, "Lower-latency GPT-5-family model for well-scoped, high-volume tasks.", 128_000],
        ["gpt-5", "GPT-5", 1.25, 10, "Previous intelligent GPT reasoning model for coding and agentic work.", 128_000],
        ["gpt-5-chat-latest", "GPT-5 Chat", 1.25, 10, "GPT-5 snapshot previously used in ChatGPT.", 16_384],
        ["gpt-5-codex", "GPT-5-Codex", 1.25, 10, "Deprecated GPT-5 coding model retained on OpenAI's model list.", 128_000],
        ["gpt-5-pro", "GPT-5 pro", 15, 120, "Higher-compute GPT-5 reasoning model for tougher requests.", 272_000],
        ["gpt-5.1", "GPT-5.1", 1.25, 10, "Earlier GPT-5 flagship for coding and agentic tasks.", 128_000],
        ["gpt-5.1-chat-latest", "GPT-5.1 Chat", 1.25, 10, "GPT-5.1 snapshot currently used in ChatGPT.", 16_384],
        ["gpt-5.1-codex", "GPT-5.1 Codex", 1.25, 10, "Deprecated GPT-5.1 coding model still documented by OpenAI.", 128_000],
        ["gpt-5.1-codex-max", "GPT-5.1-Codex-Max", 1.25, 10, "Deprecated GPT-5.1 Codex variant for longer-running coding tasks.", 128_000],
        ["gpt-5.1-codex-mini", "GPT-5.1 Codex mini", 0.25, 2, "Deprecated smaller GPT-5.1 Codex variant for cheaper coding loops.", 128_000],
        ["gpt-5.2", "GPT-5.2", 1.75, 14, "Previous frontier GPT model for complex professional work.", 128_000],
        ["gpt-5.2-chat-latest", "GPT-5.2 Chat", 1.75, 14, "GPT-5.2 snapshot currently used in ChatGPT.", 16_384],
        ["gpt-5.2-codex", "GPT-5.2-Codex", 1.75, 14, "Deprecated GPT-5.2 coding model optimized for long-horizon software work.", 128_000],
        ["gpt-5.2-pro", "GPT-5.2 pro", 21, 168, "Previous pro GPT model with much higher compute per request.", 128_000],
        ["gpt-5.3-chat-latest", "GPT-5.3 Chat", 1.75, 14, "GPT-5.3 Instant snapshot currently used in ChatGPT.", 16_384],
        ["gpt-5.3-codex", "GPT-5.3-Codex", 1.75, 14, "Current most capable agentic coding model on OpenAI's Codex line.", 128_000],
        ["codex-mini-latest", "codex-mini-latest", 1.5, 6, "Deprecated fast Codex CLI model fine-tuned from o4-mini.", 100_000],
        ["gpt-4.1-nano", "GPT-4.1 nano", 0.1, 0.4, "Fastest GPT-4.1 variant.", 32_768],
        ["gpt-4.1-mini", "GPT-4.1 mini", 0.4, 1.6, "Smaller, faster GPT-4.1 release.", 32_768],
        ["gpt-4.1", "GPT-4.1", 2, 8, "Smartest non-reasoning GPT-4.1 release.", 32_768],
        ["gpt-4o-mini", "GPT-4o mini", 0.15, 0.6, "Affordable multimodal GPT-4o mini release.", 16_384],
        ["gpt-4o", "GPT-4o", 2.5, 10, "Versatile multimodal GPT-4o flagship outside the o-series.", 16_384],
        ["o3-mini", "o3-mini", 1.1, 4.4, "Small reasoning model alternative to o3.", 100_000],
        ["o4-mini", "o4-mini", 1.1, 4.4, "Fast, cost-efficient reasoning model succeeded by GPT-5 mini.", 100_000],
        ["o3", "o3", 2, 8, "Well-rounded reasoning model for complex technical work.", 100_000],
        ["o3-pro", "o3-pro", 20, 80, "Higher-compute o3 variant for tougher reasoning requests.", 100_000],
        ["o1-mini", "o1-mini", 1.1, 4.4, "Earlier small o-series reasoning model retained for compatibility.", 65_536],
        ["o1", "o1", 15, 60, "Previous full o-series reasoning model.", 100_000],
    ],
    gemini: [
        ["gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite", 0.1, 0.4, "Google's lowest-cost current text model for high-throughput workloads.", 65_536],
        ["gemini-2.5-flash-lite-preview-09-2025", "Gemini 2.5 Flash-Lite Preview", 0.1, 0.4, "Preview Flash-Lite variant optimized for cost-efficiency and throughput.", 65_536],
        ["gemini-2.5-flash", "Gemini 2.5 Flash", 0.3, 2.5, "Google's best price-performance reasoning model for large-scale prompting.", 65_536],
        ["gemini-2.5-flash-preview-09-2025", "Gemini 2.5 Flash Preview", 0.3, 2.5, "Preview Flash variant for low-latency, high-volume agentic use cases.", 65_536],
        ["gemini-2.5-pro", "Gemini 2.5 Pro", 1.25, 10, "Current stable Gemini reasoning model for complex coding and analysis.", 65_536],
        ["gemini-3-flash-preview", "Gemini 3 Flash Preview", 0.5, 3, "Current Gemini 3 preview model built for speed, scale, and frontier intelligence.", 65_536],
        ["gemini-3-pro-preview", "Gemini 3 Pro Preview", 2, 12, "Current Gemini 3 preview flagship for multimodal reasoning and agentic coding.", 65_536],
        ["gemini-2.0-flash-lite", "Gemini 2.0 Flash-Lite", 0.075, 0.3, "Previous low-cost Gemini 2.0 model still listed in Google's catalog.", 8_192],
        ["gemini-2.0-flash", "Gemini 2.0 Flash", 0.1, 0.4, "Previous Gemini 2.0 workhorse model still listed in Google's catalog.", 8_192],
    ],
    deepseek: [
        ["deepseek-v4-flash", "DeepSeek V4 Flash", 0.14, 0.28, "Current DeepSeek workhorse with 1M context and both thinking and non-thinking modes.", 384_000],
        ["deepseek-v4-pro", "DeepSeek V4 Pro", 0.435, 0.87, "Current DeepSeek flagship; pricing reflects the official 75% discount active through 2026-05-05 UTC.", 384_000],
        ["deepseek-chat", "DeepSeek Chat", 0.14, 0.28, "Compatibility name for DeepSeek V4 Flash non-thinking mode; scheduled to retire on 2026-07-24.", 384_000],
        ["deepseek-reasoner", "DeepSeek Reasoner", 0.14, 0.28, "Compatibility name for DeepSeek V4 Flash thinking mode; scheduled to retire on 2026-07-24.", 384_000],
    ],
    grok: [
        ["grok-4-1-fast-reasoning", "Grok 4.1 Fast Reasoning", 0.2, 0.5, "Current fast, low-cost Grok reasoning model."],
        ["grok-4-1-fast-non-reasoning", "Grok 4.1 Fast Non-Reasoning", 0.2, 0.5, "Current non-reasoning Grok 4.1 Fast variant."],
        ["grok-4-fast-reasoning", "Grok 4 Fast Reasoning", 0.2, 0.5, "Earlier low-cost Grok 4 Fast reasoning release still listed by xAI."],
        ["grok-4-fast-non-reasoning", "Grok 4 Fast Non-Reasoning", 0.2, 0.5, "Earlier non-reasoning Grok 4 Fast release still listed by xAI."],
        ["grok-4.20-reasoning", "Grok 4.20 Reasoning", 2, 6, "Current xAI flagship reasoning model with 2M context and stronger tool use."],
        ["grok-4.20-non-reasoning", "Grok 4.20 Non-Reasoning", 2, 6, "Current non-reasoning Grok 4.20 variant."],
        ["grok-4.20-multi-agent", "Grok 4.20 Multi-Agent", 2, 6, "Current multi-agent Grok 4.20 research model; total cost scales with agent count."],
        ["grok-code-fast-1", "Grok Code Fast 1", 0.2, 1.5, "Fast Grok coding model optimized for code-heavy workloads."],
        ["grok-4-0709", "Grok 4 (0709)", 3, 15, "Earlier full Grok 4 reasoning model still listed by xAI."],
        ["grok-3-mini", "Grok 3 Mini", 0.3, 0.5, "Earlier compact Grok reasoning model still listed by xAI."],
        ["grok-3", "Grok 3", 3, 15, "Earlier full Grok model still listed by xAI."],
    ],
} as const satisfies Record<Provider, readonly ModelSeed[]>

export const providerModels: Models = createProviderModels(rawModels)
export const models = providerModels

function createProviderModels(raw: Record<Provider, readonly ModelSeed[]>): Models {
    return {
        anthropic: createModels(raw.anthropic),
        openai: createModels(raw.openai),
        gemini: createModels(raw.gemini),
        deepseek: createModels(raw.deepseek),
        grok: createModels(raw.grok),
    }
}

function createModels(entries: readonly ModelSeed[]): ModelInfo[] {
    return entries.map(createModel)
}

function createModel([
    name,
    display_name,
    input_cost,
    output_cost,
    description,
    max_output_tokens,
]: ModelSeed): ModelInfo {
    return {
        name,
        display_name,
        description,
        input_cost,
        output_cost,
        max_output_tokens,
    }
}
