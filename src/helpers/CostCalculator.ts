//
// Helpers
//
// Rueter AI
// created by Aaron Meche
//

import type { ModelInfo, UsageCost } from "../types.js"

export function calculateUsageCost(res: Record<string, unknown>, model: ModelInfo): UsageCost {
    const usage = res?.usage as Record<string, number> | undefined
    const usageMeta = res?.usage_metadata as Record<string, number> | undefined

    const inputTok =
        usage?.prompt_tokens ??
        usage?.input_tokens ??
        usageMeta?.prompt_token_count ?? 0
    const outputTok =
        usage?.completion_tokens ??
        usage?.output_tokens ??
        usageMeta?.candidates_token_count ??
        usageMeta?.output_token_count ?? 0
    const inputPrice = (inputTok * model.input_cost) / 1_000_000
    const outputPrice = (outputTok * model.output_cost) / 1_000_000
    const totalPrice = inputPrice + outputPrice

    return {
        model: model.name,
        input: inputPrice.toFixed(8),
        output: outputPrice.toFixed(8),
        total: totalPrice.toFixed(8)
    }
}