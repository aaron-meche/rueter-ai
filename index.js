//
// Rueter AI
//
// created by Aaron Meche
//

import { APIKey } from "./env.js"
import { models } from "./models.js"

//
// HTTPRequest
//
// Default HTTP Request Method
//

class AIModel {
    // AI Model Specific Values
    #provider = null
    #model = null
    #apiKey = null
    // Tinkering Values
    #systemPrompt = ""
    #temperature = 0.7
    #maxTokens = 1024
    // Company-Specific HTTP Request Formatting
    #builders = {
        "anthropic": (prompt) => ({
            url: "https://api.anthropic.com/v1/messages",
            method: "POST",
            headers: {
                "x-api-key": this.#apiKey,
                "anthropic-version": "2023-06-01"
            },
            body: {
                model: this.#model?.name,
                max_tokens: this.#maxTokens,
                temperature: this.#temperature,
                system: this.#systemPrompt,
                messages: [
                    { role: "user", content: prompt }
                ]
            }
        }),
        "grok": (prompt) => {
            return {
                url: "https://api.x.ai/v1/chat/completions",
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.#apiKey}`
                },
                body: {
                    model: this.#model?.name,
                    messages: [
                        { role: "system", content: this.#systemPrompt },
                        { role: "user",   content: prompt }
                    ],
                    temperature: this.#temperature,
                    max_tokens: this.#maxTokens
                }
            }
        },
        "openai": (prompt) => ({
            url: "https://api.openai.com/v1/chat/completions",
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.#apiKey}`
            },
            body: {
                model: this.#model?.name,
                messages: [
                    { role: "system", content: this.#systemPrompt },
                    { role: "user",   content: prompt }
                ],
                temperature: this.#temperature,
                max_tokens: this.#maxTokens
            }
        }),
        "gemini": (prompt) => ({
            url: `https://generativelanguage.googleapis.com/v1beta/models/${this.#model.name}:generateContent?key=${this.#apiKey}`,
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: this.#temperature,
                    maxOutputTokens: this.#maxTokens
                },
                systemInstruction: this.#systemPrompt ? { parts: [{ text: this.#systemPrompt }] }  : undefined
            }
        })
    }

    constructor(provider, apiKey, model = 0) {
        this.#provider = provider || null
        this.#apiKey = apiKey || null
        this.#model = models[provider][model] || null
    }

    async #httpRequest(builder) {
        const options = {
            method: builder.method,
            headers: {
                "Content-Type": "application/json",
                ...builder.headers
            },
            body: JSON.stringify(builder.body)
        }
        const response = await fetch(builder.url, options)

        if (!response.ok)   throw new Error(`HTTP ${response.status} - ${response.statusText}`)
        else                return await response.json()
    }

    async prompt(prompt, callback) {
        const builder = this.#builders[this.#provider](prompt)
        const res = await this.#httpRequest(builder)
        const responseText = 
            res.choices?.[0]?.message?.content ||             // Grok + OpenAI (chat completions style)
            res.content?.[0]?.text ||                         // Anthropic (Claude messages)
            res.candidates?.[0]?.content?.parts?.[0]?.text || // Gemini
            res.output_text ||                                // fallback for older xAI responses API
            JSON.stringify(res);
        callback(responseText, res)
    }

    setSystemPrompt(sysPrompt) {
        if (typeof sysPrompt !== "string" || sysPrompt.trim().length == 0) return
        this.#systemPrompt = sysPrompt.trim()
    }

    setTemperature(temp) {
        if (!Number.isFinite(temp) || temp < 0 || temp > 1) return
        this.#temperature = temp
    }

    setMaxTokens(maxTok) {
        if (!Number.isInteger(maxTok) || maxTok <= 0 || maxTok > 100_000) return
        this.#maxTokens = maxTok
    }
}

class AIOrchestra {
    #models = []

    constructor() {

    }
    
    addModel(provider, apiKey, model = 0) {
        this.#models.push(new AIModel(provider, apiKey, model))
    }

    async prompt(prompt, callback) {
        this.#models.forEach(model => {
            model.prompt(prompt, res => {
                callback(res)
            })
        })
    }

    setSystemPrompt(sysPrompt) {
        this.#models.forEach(model => {
            model.setSystemPrompt(sysPrompt)
        })
    }

    setMaxTemperature(temp) {
        this.#models.forEach(model => {
            model.setMaxTemperature(temp)
        })
    }

    setMaxTokens(maxTok) {
        this.#models.forEach(model => {
            model.setMaxTokens(maxTok)
        })
    }
}

function main() {
    const prompt = "How to print to console in javascript?"
    let orchestra = new AIOrchestra()
    orchestra.addModel("anthropic", APIKey.anthropic)
    orchestra.addModel("grok", APIKey.grok)
    orchestra.addModel("gemini", APIKey.gemini)
    orchestra.setMaxTokens(12)
    orchestra.setSystemPrompt("Respond in the shorted format possible. No explanation, formatting, or extra text. Plaintext only")
    orchestra.prompt(prompt, res => {
        console.log(res)
    })
}
main()  