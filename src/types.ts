/**
 * Rueter - Type Definitions
 */

export interface ModelConfig {
    name: string;
    model?: string;
    input_cost: number;
    output_cost: number;
    context: number;
    description: string;
}

export type Provider = 'anthropic' | 'openai' | 'gemini' | 'grok';

export interface CostBreakdown {
    model: string;
    input: number;
    output: number;
    total: number;
}

export interface PromptResult {
    response: string;
    cost: CostBreakdown;
}

export interface OrchestraResult {
    [modelId: string]: {
        res: string | null;
        cost: number;
        error?: string;
    };
}

export interface RueterConfig {
    models?: any[];           // Temporary to avoid circular import
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}