/**
 * Rueter AI - Unified Multi-Provider AI Client
 */

import type { 
    ModelConfig, 
    CostBreakdown, 
    PromptResult, 
    OrchestraResult, 
    RueterConfig 
} from './types.js';

import { models, getModel, type Provider } from './models.js';

export class RueterModel {
    readonly #provider: Provider;
    readonly #model: ModelConfig;
    readonly #apiKey: string;

    #systemPrompt: string = "";
    #temperature: number = 0.7;
    #maxTokens: number = 1024;

    constructor(provider: Provider, apiKey: string, modelIndex: number = 0) {
        this.#provider = provider;
        this.#apiKey = apiKey;
        this.#model = getModel(provider, modelIndex);
    }

    private get builders() {
        return {
            anthropic: (prompt: string) => ({
                url: "https://api.anthropic.com/v1/messages",
                method: "POST" as const,
                headers: {
                    "x-api-key": this.#apiKey,
                    "anthropic-version": "2023-06-01"
                },
                body: {
                    model: this.#model.model || this.#model.name,
                    max_tokens: this.#maxTokens,
                    temperature: this.#temperature,
                    system: this.#systemPrompt,
                    messages: [{ role: "user", content: prompt }]
                }
            }),

            grok: (prompt: string) => ({
                url: "https://api.x.ai/v1/chat/completions",
                method: "POST" as const,
                headers: { "Authorization": `Bearer ${this.#apiKey}` },
                body: {
                    model: this.#model.model || this.#model.name,
                    messages: [
                        { role: "system", content: this.#systemPrompt },
                        { role: "user", content: prompt }
                    ],
                    temperature: this.#temperature,
                    max_tokens: this.#maxTokens
                }
            }),

            openai: (prompt: string) => ({
                url: "https://api.openai.com/v1/chat/completions",
                method: "POST" as const,
                headers: { "Authorization": `Bearer ${this.#apiKey}` },
                body: {
                    model: this.#model.model || this.#model.name,
                    messages: [
                        { role: "system", content: this.#systemPrompt },
                        { role: "user", content: prompt }
                    ],
                    temperature: this.#temperature,
                    max_tokens: this.#maxTokens
                }
            }),

            gemini: (prompt: string) => ({
                url: `https://generativelanguage.googleapis.com/v1beta/models/${this.#model.model || this.#model.name}:generateContent?key=${this.#apiKey}`,
                method: "POST" as const,
                headers: { "Content-Type": "application/json" },
                body: {
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: this.#temperature,
                        maxOutputTokens: this.#maxTokens
                    },
                    systemInstruction: this.#systemPrompt 
                        ? { parts: [{ text: this.#systemPrompt }] } 
                        : undefined
                }
            })
        };
    }

    async prompt(prompt: string): Promise<PromptResult> {
        const builderFn = this.builders[this.#provider as keyof typeof this.builders];
        const builder = builderFn(prompt);

        const response = await fetch(builder.url, {
            method: builder.method,
            headers: {
                "Content-Type": "application/json",
                ...builder.headers
            },
            body: JSON.stringify(builder.body)
        });

        if (!response.ok) {
            throw new Error(`[${this.#provider}] HTTP ${response.status}: ${response.statusText}`);
        }

        const res = await response.json();

        const responseText = 
            res.choices?.[0]?.message?.content ||
            res.content?.[0]?.text ||
            res.candidates?.[0]?.content?.parts?.[0]?.text ||
            res.output_text ||
            JSON.stringify(res);

        const cost = this.calculateCost(res);

        return { response: responseText, cost };
    }

    private calculateCost(res: any): CostBreakdown {
        let inputTok = 
            res?.usage?.prompt_tokens || 
            res?.usage?.input_tokens || 
            res?.usage_metadata?.prompt_token_count || 0;

        let outputTok = 
            res?.usage?.completion_tokens || 
            res?.usage?.output_tokens || 
            res?.usage_metadata?.candidates_token_count || 
            res?.usage_metadata?.output_token_count || 0;

        const input = (inputTok * (this.#model.input_cost || 0)) / 1_000_000;
        const output = (outputTok * (this.#model.output_cost || 0)) / 1_000_000;
        const total = input + output;

        return {
            model: this.#model.name,
            input: Number(input.toFixed(8)),
            output: Number(output.toFixed(8)),
            total: Number(total.toFixed(8))
        };
    }

    setSystemPrompt(prompt: string): void {
        this.#systemPrompt = prompt.trim();
    }

    setTemperature(temp: number): void {
        if (temp >= 0 && temp <= 1) this.#temperature = temp;
    }

    setMaxTokens(tokens: number): void {
        if (tokens > 0) this.#maxTokens = Math.min(tokens, 100000);
    }

    getID(): string {
        return `${this.#provider}_${this.#model.name}`;
    }
}

// Main Orchestra Class
export class Rueter {
    #models: RueterModel[] = [];

    constructor(config: RueterConfig = {}) {
        if (config.models) this.#models = config.models;
        if (config.systemPrompt) this.setSystemPrompt(config.systemPrompt);
        if (config.temperature !== undefined) this.setTemperature(config.temperature);
        if (config.maxTokens !== undefined) this.setMaxTokens(config.maxTokens);
    }

    addModel(provider: Provider, apiKey: string, modelIndex: number = 0): void {
        this.#models.push(new RueterModel(provider, apiKey, modelIndex));
    }

    async prompt(prompt: string): Promise<OrchestraResult> {
        const promises = this.#models.map(async (model) => {
            const id = model.getID();
            try {
                const { response, cost } = await model.prompt(prompt);
                return { id, res: response, cost: cost.total };
            } catch (error: any) {
                console.error(`Error with model ${id}:`, error.message);
                return { id, res: null, cost: 0, error: error.message };
            }
        });

        const completed = await Promise.all(promises);
        const results: OrchestraResult = {};

        completed.forEach(({ id, res, cost, error }) => {
            results[id] = { res, cost, ...(error && { error }) };
        });

        return results;
    }

    setSystemPrompt(prompt: string): void {
        this.#models.forEach(m => m.setSystemPrompt(prompt));
    }

    setTemperature(temp: number): void {
        this.#models.forEach(m => m.setTemperature(temp));
    }

    setMaxTokens(tokens: number): void {
        this.#models.forEach(m => m.setMaxTokens(tokens));
    }
}

export default Rueter;