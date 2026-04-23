import type { Provider } from "../../src/const/Types.js"

export const providerApiKeyEnvVars: Record<Provider, string[]> = {
    anthropic: ["ANTHROPIC_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    grok: ["GROK_API", "XAI_API_KEY"],
}

export interface ProviderEnvStatus {
    provider: Provider
    envVars: string[]
    ready: boolean
}

export function hasInteractiveTerminal(): boolean {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY && process.env.TERM !== "dumb")
}

export function getProviderEnvStatuses(): ProviderEnvStatus[] {
    return (Object.keys(providerApiKeyEnvVars) as Provider[]).map((provider) => {
        const envVars = providerApiKeyEnvVars[provider]
        return {
            provider,
            envVars,
            ready: envVars.some(name => Boolean(process.env[name])),
        }
    })
}
