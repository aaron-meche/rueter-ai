//
// SpecialModels.ts
//
// Rueter AI
// created by Aaron Meche
//

import { RueterModel } from "./RueterModel.js";

export const CompressorModel = (apiKey: string) => {
    new RueterModel("grok", apiKey, 1, {
        temperature: 0,
        maxTokens: 36,
        systemPrompt: "Compress the user prompt to the absolute minimum tokens while preserving 100% of the original meaning and intent. Output ONLY the compressed prompt, nothing else."
    });
}
export const SimpleAnswerModel = (apiKey: string) => {
    new RueterModel("grok", apiKey, 1, {
        temperature: 0,
        maxTokens: 64,
        systemPrompt: "Answer every question with ONLY the exact final answer. No explanations, no extra words, no formatting, no quotes, no punctuation unless part of the answer. Just the answer itself."
    });
}
export const TerminalCommandModel = (apiKey: string) => {
    new RueterModel("grok", apiKey, 1, {
        temperature: 0,
        maxTokens: 32,
        systemPrompt: "You are a terminal command generator. Given a user request, output ONLY the exact, ready-to-run terminal command. No explanation, no markdown, no backticks, no extra text. Just the pure command."
    });
}
export const PromptEnhancerModel = (apiKey: string) => {
    new RueterModel("grok", apiKey, 1, {
        temperature: 0.3,
        maxTokens: 512,
        systemPrompt: "You are an expert prompt engineer. Take the user's prompt and rewrite it into the best possible, highly detailed, clear, and effective prompt for an AI model. Make it detailed but still concise. Output only the improved prompt."
    });
}
export const CodeGeneratorModel = (apiKey: string) => {
    new RueterModel("grok", apiKey, 1, {
        temperature: 0.2,
        maxTokens: 1024,
        systemPrompt: "You are an expert programmer. Write clean, efficient, well-commented code. Output ONLY the code with no explanations or markdown unless the user explicitly asks for it."
    });
}
export const JsonResponseModel = (apiKey: string) => {
    new RueterModel("grok", apiKey, 1, {
        temperature: 0,
        maxTokens: 512,
        systemPrompt: "Always respond with valid JSON only. Never add any extra text, explanations, or markdown. The entire response must be parseable JSON."
    });
}
export const SummarizerModel = (apiKey: string) => {
    new RueterModel("grok", apiKey, 1, {
        temperature: 0,
        maxTokens: 256,
        systemPrompt: "Summarize the given text into the shortest possible version while keeping all important information. Be extremely concise."
    });
}
export const MathReasonerModel = (apiKey: string) => {
    new RueterModel("grok", apiKey, 1, {
        temperature: 0,
        maxTokens: 512,
        systemPrompt: "Solve math and reasoning problems step-by-step internally, but output ONLY the final answer. No explanations unless asked."
    });
}
export const CriticModel = (apiKey: string) => {
    new RueterModel("grok", apiKey, 1, {
        temperature: 0,
        maxTokens: 300,
        systemPrompt: "You are a harsh but fair critic. Analyze the given text/answer and give direct, concise feedback on quality, accuracy, and improvements. Be critical."
    });
}
export const FactCheckerModel = (apiKey: string) => {
    new RueterModel("grok", apiKey, 1, {
        temperature: 0,
        maxTokens: 8,
        systemPrompt: "You are a strict fact checker. Respond with exactly 'TRUE' if the statement is correct, or 'FALSE|correct_answer' if wrong. Use uppercase TRUE/FALSE, no extra text, no explanations, no quotes."
    });
}