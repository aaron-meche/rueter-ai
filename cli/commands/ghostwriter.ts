import { performance } from "node:perf_hooks"

import { GhostWriter } from "../../src/functions/GhostWriter.js"

import type { CommandDefinition } from "../types.js"
import { resolveApiKeyValue } from "../core/env.js"
import { readStringFlag } from "../core/flags.js"
import { recordHistory } from "../core/history.js"
import { resolveHistoryLines, resolvePromptText } from "../core/input.js"
import { renderHeader, renderJson, renderKeyValueRows, renderSubsection } from "../ui/render.js"

export const ghostwriterCommands: readonly CommandDefinition[] = [
    {
        path: ["ghostwriter", "run"],
        summary: "Rewrite an assignment using prior writing samples.",
        description: "Runs the exported GhostWriter helper with prior writing samples and a new assignment prompt. It uses the same Grok/xAI API key path as the built-in specialized model presets.",
        usage: "rueter ghostwriter run [--history-file <path>] [--prompt <text> | --file <path> | --stdin] [--api-key-env <ENV>] [--raw] [--json]",
        options: [
            { flag: "--history-file <path>", description: "File containing prior writing samples. Separate samples with --- or === on their own line." },
            { flag: "--prompt <text>", description: "Assignment or writing request to complete in the learned style." },
            { flag: "--file <path>", description: "Read the assignment prompt from a file." },
            { flag: "--stdin", description: "Read the assignment prompt from stdin." },
            { flag: "--api-key-env <ENV>", description: "Explicit env var containing the Grok/xAI API key." },
            { flag: "--raw", description: "Print only the rewritten output." },
            { flag: "--no-history", description: "Do not record this run in local CLI history." },
            { flag: "--json", description: "Output the run metadata and rewritten output as JSON." },
        ],
        examples: [
            "rueter ghostwriter run --history-file ./samples.txt --prompt \"Write a short project update.\"",
            "rueter ghostwriter run --history-file ./samples.txt --file ./assignment.txt --raw",
        ],
        async run(context) {
            const history = await resolveHistoryLines(context)
            const prompt = await resolvePromptText(context, 0, "Enter the assignment for GhostWriter")
            const { envName, apiKey } = resolveApiKeyValue("grok", readStringFlag(context.flags, "apiKeyEnv"))

            const startedAt = performance.now()
            const output = await GhostWriter(apiKey, history, prompt, { log: false })
            const durationMs = performance.now() - startedAt
            const result = {
                name: "ghostwriter",
                provider: "grok" as const,
                prompt,
                historySamples: history.length,
                durationMs,
                result: output,
                apiKeyEnv: envName,
            }

            await recordHistory(context, {
                targetType: "ghostwriter",
                targetName: "ghostwriter",
                provider: "grok",
                prompt,
                durationMs,
                result,
            })

            if (context.flags.json === true) {
                console.log(renderJson(result))
                return 0
            }

            if (context.flags.raw === true) {
                console.log(output)
                return 0
            }

            console.log([
                renderHeader("GhostWriter Result", `${history.length} writing sample${history.length === 1 ? "" : "s"}`),
                renderKeyValueRows([
                    { label: "provider", value: "Grok / xAI" },
                    { label: "duration", value: formatDuration(durationMs) },
                    { label: "api env", value: envName },
                ]),
                "",
                renderSubsection("Output"),
                output,
            ].join("\n"))

            return 0
        },
    },
]

function formatDuration(value: number): string {
    if (value < 1000) return `${value.toFixed(0)}ms`
    return `${(value / 1000).toFixed(2)}s`
}
