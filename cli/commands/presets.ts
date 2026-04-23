import type { CommandDefinition } from "../types.js"
import { resolveApiKeyValue } from "../core/env.js"
import { CliError } from "../core/errors.js"
import { readStringFlag } from "../core/flags.js"
import { recordHistory } from "../core/history.js"
import { resolvePromptText } from "../core/input.js"
import {
    DEFAULT_SPECIAL_PRESET_MODEL,
    DEFAULT_SPECIAL_PRESET_PROVIDER,
    listPresets,
    resolvePreset,
} from "../core/presets.js"
import { renderHeader, renderJson, renderModelExecutionResult, renderRawModelResult } from "../ui/render.js"
import { selectOption } from "../ui/select.js"
import { performance } from "node:perf_hooks"

export const presetCommands: readonly CommandDefinition[] = [
    {
        path: ["presets", "list"],
        summary: "List the built-in specialized model presets exported by rueter-ai.",
        description: "Shows the preset registry exposed through SpecialModels.ts. These are provider-agnostic config presets that the CLI currently instantiates with its default Grok preset model.",
        usage: "rueter presets list [--json]",
        options: [
            { flag: "--json", description: "Output the preset registry as JSON." },
        ],
        examples: [
            "rueter presets list",
        ],
        async run(context) {
            const presets = listPresets()
            if (context.flags.json === true) {
                console.log(renderJson(presets))
                return 0
            }

            console.log([
                renderHeader("Built-in Presets", `${presets.length} config presets`),
                presets.map(preset => `${preset.key}\n  ${preset.exportName}`).join("\n\n"),
            ].join("\n"))
            return 0
        },
    },
    {
        path: ["presets", "run"],
        summary: "Run one built-in specialized model preset.",
        description: "Instantiates one preset config with the CLI's default Grok preset model, resolves a Grok/xAI API key from the environment, sends a prompt, and prints the result.",
        usage: "rueter presets run <name> [--api-key-env <ENV>] [--prompt <text> | --file <path> | --stdin] [--raw] [--json]",
        options: [
            { flag: "--api-key-env <ENV>", description: "Explicit env var containing the Grok/xAI API key." },
            { flag: "--prompt <text>", description: "Prompt text to send." },
            { flag: "--file <path>", description: "Read prompt text from a file." },
            { flag: "--stdin", description: "Read prompt text from stdin." },
            { flag: "--raw", description: "Print only the model response text." },
            { flag: "--no-history", description: "Do not record this run in local CLI history." },
            { flag: "--json", description: "Output the response as JSON." },
        ],
        examples: [
            "rueter presets run simple-answer --prompt \"Capital of Japan\"",
            "rueter presets run prompt-enhancer --file ./prompt.txt",
        ],
        async run(context) {
            const presetName = await resolvePresetName(context)
            const preset = resolvePreset(presetName)
            const prompt = await resolvePromptText({ ...context, args: context.args.slice(context.args[0] ? 1 : 0) }, 0, "Enter the prompt for this preset")
            const { envName, apiKey } = resolveApiKeyValue(DEFAULT_SPECIAL_PRESET_PROVIDER, readStringFlag(context.flags, "apiKeyEnv"))
            const model = preset.create(apiKey)

            const startedAt = performance.now()
            const response = await model.prompt(prompt)
            const durationMs = performance.now() - startedAt
            const execution = {
                name: preset.key,
                provider: DEFAULT_SPECIAL_PRESET_PROVIDER,
                modelName: DEFAULT_SPECIAL_PRESET_MODEL,
                prompt,
                durationMs,
                result: {
                    res: response,
                    cost: null,
                },
                apiKeyEnv: envName,
            }
            await recordHistory(context, {
                targetType: "preset",
                targetName: preset.key,
                provider: DEFAULT_SPECIAL_PRESET_PROVIDER,
                modelName: DEFAULT_SPECIAL_PRESET_MODEL,
                prompt,
                durationMs,
                result: execution,
            })

            if (context.flags.json === true) {
                console.log(renderJson(execution))
                return 0
            }

            if (context.flags.raw === true) {
                console.log(renderRawModelResult(execution))
                return 0
            }

            console.log(renderModelExecutionResult(execution))
            return 0
        },
    },
]

async function resolvePresetName(context: Parameters<CommandDefinition["run"]>[0]): Promise<string> {
    const positional = context.args[0]
    if (positional) return positional

    if (!context.interactive) throw new CliError("Provide a preset name, for example: rueter presets run simple-answer")

    const selected = await selectOption("Choose a preset to run", listPresets().map(preset => ({
        value: preset.key,
        label: preset.key,
        hint: preset.exportName,
    })))
    return selected
}
