import {
    BugHunterWorkflow,
    CodeProjectGenerator,
    CodeRefactorWorkflow,
    PersonalAuthor,
    ResearchAssistantWorkflow,
} from "../../src/index.js"

import { CliError } from "./errors.js"
import { readBooleanFlag, readCsvFlag, readIntegerFlag, readRequiredStringFlag, readStringFlag } from "./flags.js"
import type { CliFlags } from "../types.js"

export interface WorkflowDefinition {
    key: string
    label: string
    summary: string
    requiredFlags: readonly string[]
    optionalFlags: readonly string[]
    run(flags: CliFlags, options: { apiKey: string; onProgress(message: string): void }): Promise<unknown>
}

const workflowRegistry: readonly WorkflowDefinition[] = [
    {
        key: "code-project",
        label: "Code Project Generator",
        summary: "Generate a project from a high-level prompt and write files to disk.",
        requiredFlags: ["project-prompt or --prompt", "output-dir"],
        optionalFlags: ["project-md-path"],
        async run(flags, options) {
            await CodeProjectGenerator({
                apiKey: options.apiKey,
                projectPrompt: readStringFlag(flags, "projectPrompt") ?? readRequiredStringFlag(flags, "prompt"),
                outputDir: readRequiredStringFlag(flags, "outputDir"),
                projectMdPath: readStringFlag(flags, "projectMdPath"),
                onProgress: options.onProgress,
            })
            return { status: "ok" }
        },
    },
    {
        key: "bug-hunter",
        label: "Bug Hunter",
        summary: "Scan a source directory for logic bugs and security issues.",
        requiredFlags: ["source-dir"],
        optionalFlags: ["report-path", "extensions"],
        async run(flags, options) {
            await BugHunterWorkflow({
                apiKey: options.apiKey,
                sourceDir: readRequiredStringFlag(flags, "sourceDir"),
                reportPath: readStringFlag(flags, "reportPath"),
                extensions: readCsvFlag(flags, "extensions"),
                onProgress: options.onProgress,
            })
            return { status: "ok" }
        },
    },
    {
        key: "code-refactor",
        label: "Code Refactor",
        summary: "Refactor a source directory and optionally generate tests.",
        requiredFlags: ["source-dir", "output-dir"],
        optionalFlags: ["report-path", "extensions", "generate-tests"],
        async run(flags, options) {
            await CodeRefactorWorkflow({
                apiKey: options.apiKey,
                sourceDir: readRequiredStringFlag(flags, "sourceDir"),
                outputDir: readRequiredStringFlag(flags, "outputDir"),
                reportPath: readStringFlag(flags, "reportPath"),
                extensions: readCsvFlag(flags, "extensions"),
                generateTests: readBooleanFlag(flags, "generateTests"),
                onProgress: options.onProgress,
            })
            return { status: "ok" }
        },
    },
    {
        key: "research-assistant",
        label: "Research Assistant",
        summary: "Generate a structured research document on a given topic.",
        requiredFlags: ["topic"],
        optionalFlags: ["output-path", "sections"],
        async run(flags, options) {
            return await ResearchAssistantWorkflow({
                apiKey: options.apiKey,
                topic: readRequiredStringFlag(flags, "topic"),
                outputPath: readStringFlag(flags, "outputPath"),
                sections: readIntegerFlag(flags, "sections"),
                onProgress: options.onProgress,
            })
        },
    },
    {
        key: "personal-author",
        label: "Personal Author",
        summary: "Analyze writing samples and generate a new piece in the same style.",
        requiredFlags: ["assignment"],
        optionalFlags: ["author-md-path", "output-path"],
        async run(flags, options) {
            return await PersonalAuthor({
                apiKey: options.apiKey,
                assignment: readRequiredStringFlag(flags, "assignment"),
                authorMdPath: readStringFlag(flags, "authorMdPath"),
                outputPath: readStringFlag(flags, "outputPath"),
                onProgress: options.onProgress,
            })
        },
    },
]

export function listWorkflows(): readonly WorkflowDefinition[] {
    return workflowRegistry
}

export function resolveWorkflow(key: string): WorkflowDefinition {
    const match = workflowRegistry.find(workflow => workflow.key === key)
    if (!match) throw new CliError(`Unknown workflow "${key}". Run "rueter workflows list" to see available workflows.`)
    return match
}
