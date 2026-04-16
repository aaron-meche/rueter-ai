//
// Rueter AI
//
// created by Aaron Meche
//

import { AnthropicAPIKey, XAPIKey } from "./env.js"
import { baseURLs, models } from "./models.js"

//
// HTTPRequest
//
// Default HTTP Request Method
//
async function HTTPRequest(builder) {
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

class AIModel {
    #provider = null
    #model = null
    #apiKey = null
    #systemPrompt = ""
    #temperature = 0.7
    #maxTokens = 1024
    #builders = {
        "grok": (prompt) => {
            return {
                url: baseURLs[this.#provider],
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
        }
    }

    constructor(provider, apiKey, model = 0) {
        this.#provider = provider || null
        this.#apiKey = apiKey || null
        this.#model = models[provider][model] || null
    }

    async prompt(prompt, callback) {
        const builder = this.#builders[this.#provider](prompt)
        const res = await HTTPRequest(builder)
        const responseText = res.choices?.[0]?.message?.content || res.output_text || JSON.stringify(data)
        callback(responseText, res)
    }
}

function main() {
    let model1 = new AIModel("grok", XAPIKey)
    model1.prompt("Hello, how are you doing today?", res => {
        console.log(res)
    })
}
main()  