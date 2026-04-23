import type { CommandDefinition } from "../types.js"
import { resolveApiKeyValue } from "../core/env.js"
import { CliError } from "../core/errors.js"
import { readStringFlag } from "../core/flags.js"
import { listWorkflows, resolveWorkflow } from "../core/workflows.js"
import { renderHeader, renderJson } from "../ui/render.js"
import { selectOption } from "../ui/select.js"

export const workflowCommands: readonly CommandDefinition[] = [
    {
        path: ["workflows", "list"],
        summary: "List the higher-level workflow functions exported by rueter-ai.",
        description: "Shows the packaged workflow wrappers available through the CLI and the key flags each one expects.",
        usage: "rueter workflows list [--json]",
        options: [
            { flag: "--json", description: "Output the workflow registry as JSON." },
        ],
        examples: [
            "rueter workflows list",
        ],
        async run(context) {
            const workflows = listWorkflows()
            if (context.flags.json === true) {
                console.log(renderJson(workflows))
                return 0
            }

            console.log([
                renderHeader("Built-in Workflows", `${workflows.length} workflow commands`),
                workflows.map(workflow => [
                    workflow.key,
                    `  ${workflow.summary}`,
                    `  required: ${workflow.requiredFlags.join(", ")}`,
                    `  optional: ${workflow.optionalFlags.join(", ") || "none"}`,
                ].join("\n")).join("\n\n"),
            ].join("\n"))
            return 0
        },
    },
    {
        path: ["workflows", "run"],
        summary: "Run one higher-level workflow exported by rueter-ai.",
        description: "Dispatches to packaged workflows like CodeProjectGenerator, BugHunterWorkflow, CodeRefactorWorkflow, ResearchAssistantWorkflow, and PersonalAuthor.",
        usage: "rueter workflows run <name> [workflow-specific flags] [--api-key-env <ENV>] [--json]",
        options: [
            { flag: "--api-key-env <ENV>", description: "Explicit env var containing the Grok/xAI API key." },
            { flag: "--json", description: "Output the workflow result as JSON." },
        ],
        examples: [
            "rueter workflows run code-project --prompt \"Build a CLI todo app\" --output-dir ./todo-app",
            "rueter workflows run bug-hunter --source-dir src",
            "rueter workflows run research-assistant --topic \"vector databases\"",
        ],
        async run(context) {
            const workflowName = await resolveWorkflowName(context)
            const workflow = resolveWorkflow(workflowName)
            const { envName, apiKey } = resolveApiKeyValue("grok", readStringFlag(context.flags, "apiKeyEnv"))
            const progress: string[] = []
            const onProgress = (message: string): void => {
                progress.push(message)
                if (context.flags.json !== true) console.log(message)
            }

            const result = await workflow.run(context.flags, { apiKey, onProgress })

            if (context.flags.json === true) {
                console.log(renderJson({
                    workflow: workflow.key,
                    apiKeyEnv: envName,
                    result,
                    progress,
                }))
                return 0
            }

            console.log([
                "",
                renderHeader("Workflow Complete", workflow.key),
            ].join("\n"))
            return 0
        },
    },
]

async function resolveWorkflowName(context: Parameters<CommandDefinition["run"]>[0]): Promise<string> {
    const positional = context.args[0]
    if (positional) return positional
    if (!context.interactive) throw new CliError("Provide a workflow name, for example: rueter workflows run code-project")

    const selected = await selectOption("Choose a workflow to run", listWorkflows().map(workflow => ({
        value: workflow.key,
        label: workflow.key,
        hint: workflow.summary,
    })))
    return selected
}
