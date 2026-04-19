//
// Builders
//
// Rueter AI
// created by Aaron Meche
//

import type { Builders, BuilderConfig, HttpRequestFormat } from "../const/Types.js"

export const builders: Builders = {
    "anthropic": (config: BuilderConfig, prompt: string): HttpRequestFormat => ({
        url: "https://api.anthropic.com/v1/messages",
        method: "POST",
        headers: {
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01"
        },
        body: {
            model: config.modelName,
            max_tokens: config.maxTokens,
            temperature: config.temperature,
            system: config.systemPrompt,
            messages: [{ role: "user", content: prompt }],
            ...(config.topP !== undefined && { top_p: config.topP }),
            ...(config.topK !== undefined && { top_k: config.topK }),
            ...(config.stopSequences && { stop_sequences: config.stopSequences })
        }
    }),
    "grok": (config: BuilderConfig, prompt: string): HttpRequestFormat => ({
        url: "https://api.x.ai/v1/chat/completions",
        method: "POST",
        headers: {
            "Authorization": `Bearer ${config.apiKey}`
        },
        body: {
            model: config.modelName,
            messages: [
                { role: "system", content: config.systemPrompt },
                { role: "user",   content: prompt }
            ],
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            ...(config.topP !== undefined && { top_p: config.topP }),
            ...(config.frequencyPenalty !== undefined && { frequency_penalty: config.frequencyPenalty }),
            ...(config.presencePenalty !== undefined && { presence_penalty: config.presencePenalty }),
            ...(config.stopSequences && { stop: config.stopSequences }),
            ...(config.n !== undefined && { n: config.n })
        }
    }),
    "openai": (config: BuilderConfig, prompt: string): HttpRequestFormat => ({
        url: "https://api.openai.com/v1/chat/completions",
        method: "POST",
        headers: {
            "Authorization": `Bearer ${config.apiKey}`
        },
        body: {
            model: config.modelName,
            messages: [
                { role: "system", content: config.systemPrompt },
                { role: "user",   content: prompt }
            ],
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            ...(config.topP !== undefined && { top_p: config.topP }),
            ...(config.frequencyPenalty !== undefined && { frequency_penalty: config.frequencyPenalty }),
            ...(config.presencePenalty !== undefined && { presence_penalty: config.presencePenalty }),
            ...(config.stopSequences && { stop: config.stopSequences }),
            ...(config.n !== undefined && { n: config.n })
        }
    }),
    "gemini": (config: BuilderConfig, prompt: string): HttpRequestFormat => ({
        url: `https://generativelanguage.googleapis.com/v1beta/models/${config.modelName}:generateContent?key=${config.apiKey}`,
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: config.temperature,
                maxOutputTokens: config.maxTokens,
                ...(config.topP !== undefined && { topP: config.topP }),
                ...(config.topK !== undefined && { topK: config.topK }),
                ...(config.stopSequences && { stopSequences: config.stopSequences }),
                ...(config.n !== undefined && { candidateCount: config.n })
            },
            ...(config.systemPrompt && {
                systemInstruction: { parts: [{ text: config.systemPrompt }] }
            })
        }
    })
}
