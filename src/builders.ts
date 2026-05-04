//
// Request Builders
//
// Rueter AI
// created by Aaron Meche
//

import type { Builders, BuilderConfig, HttpRequestFormat } from "./types.js"

export const requestBuilders: Builders = {
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
            ...(config.stopSequences && { stop: config.stopSequences })
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
            ...(config.stopSequences && { stop: config.stopSequences })
        }
    }),
    "deepseek": (config: BuilderConfig, prompt: string): HttpRequestFormat => ({
        url: "https://api.deepseek.com/v1/chat/completions",
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
            max_tokens: config.maxTokens,
            ...(config.temperature !== undefined && { temperature: config.temperature }),
            ...(config.stopSequences && { stop: config.stopSequences }),
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
                ...(config.stopSequences && { stopSequences: config.stopSequences }),
            },
            ...(config.systemPrompt && {
                systemInstruction: { parts: [{ text: config.systemPrompt }] }
            })
        }
    })
}

export const builders = requestBuilders
