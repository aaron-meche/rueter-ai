import type { Provider } from "../../src/const/Types.js"
import { CliError } from "./errors.js"

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

export function resolveApiKeyEnv(provider: Provider, explicitEnv?: string): string {
    if (explicitEnv) return explicitEnv
    const candidates = providerApiKeyEnvVars[provider]
    return candidates.find(candidate => Boolean(process.env[candidate])) ?? candidates[0]
}

export function resolveApiKeyValue(provider: Provider, explicitEnv?: string): { envName: string; apiKey: string } {
    const envName = resolveApiKeyEnv(provider, explicitEnv)
    const apiKey = process.env[envName]
    if (!apiKey) throw new CliError(`Environment variable "${envName}" is not set for provider "${provider}".`)
    return { envName, apiKey }
}
