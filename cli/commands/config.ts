import type { CommandDefinition } from "../types.js"
import { initializeCliConfig, inspectAllScopes, type CliScope } from "../core/config.js"
import { CliError } from "../core/errors.js"
import { renderBulletList, renderHeader, renderJson, renderKeyValueRows, renderStatus, renderSubsection } from "../ui/render.js"
import { selectOption } from "../ui/select.js"

const configInitCommand: CommandDefinition = {
    path: ["config", "init"],
    summary: "Create the CLI's local or global storage directories.",
    description: "Creates the root CLI directory plus models, orchestrators, history, and sessions folders. If no scope is passed in an interactive terminal, a highlighted selector asks where the CLI should store definitions.",
    usage: "rueter config init [--scope local|global] [--force] [--json]",
    options: [
        { flag: "--scope <local|global>", description: "Choose where the CLI scaffold should be created." },
        { flag: "--force", description: "Rewrite config.json even if it already exists." },
        { flag: "--json", description: "Output the result as JSON." },
    ],
    examples: [
        "rueter config init",
        "rueter config init --scope local",
        "rueter config init --scope global --force",
    ],
    async run(context) {
        const force = context.flags.force === true
        const jsonMode = context.flags.json === true
        const scope = await resolveScope(context)
        const result = await initializeCliConfig(scope, context.cwd, force)

        if (jsonMode) {
            console.log(renderJson(result))
            return 0
        }

        const summaryRows = [
            { label: "scope", value: result.scope },
            { label: "root", value: result.rootDir },
            { label: "config", value: result.configFilePath },
            { label: "root created", value: renderStatus(result.createdRootDir, "yes", "already existed") },
            { label: "config written", value: renderStatus(result.createdConfigFile, "yes", "left unchanged") },
        ]

        const createdDirsBlock = result.createdDirectories.length > 0
            ? `${renderSubsection("Created Directories")}\n${renderBulletList(result.createdDirectories)}\n`
            : `${renderSubsection("Created Directories")}\n  - No new directories were needed.\n`

        console.log([
            renderHeader("CLI Config Initialized", `${scope} scope`),
            renderKeyValueRows(summaryRows),
            "",
            createdDirsBlock.trimEnd(),
        ].join("\n"))

        return 0
    },
}

const configPathCommand: CommandDefinition = {
    path: ["config", "path"],
    summary: "Show the local and global CLI config locations.",
    description: "Prints both config roots so you can see what exists before creating or editing any saved CLI data.",
    usage: "rueter config path [--json]",
    options: [
        { flag: "--json", description: "Output the scope path information as JSON." },
    ],
    examples: [
        "rueter config path",
        "rueter config path --json",
    ],
    async run(context) {
        const scopes = await inspectAllScopes(context.cwd)

        if (context.flags.json === true) {
            console.log(renderJson(scopes))
            return 0
        }

        console.log([
            renderHeader("CLI Config Paths"),
            renderKeyValueRows(scopes.map(scope => ({
                label: scope.scope,
                value: `${renderStatus(scope.exists)}  ${scope.rootDir}`,
            }))),
        ].join("\n"))

        return 0
    },
}

export const configCommands: readonly CommandDefinition[] = [
    configInitCommand,
    configPathCommand,
]

async function resolveScope(context: { flags: Record<string, unknown>; interactive: boolean }): Promise<CliScope> {
    const scopeFlag = context.flags.scope
    if (scopeFlag === "local" || scopeFlag === "global") return scopeFlag
    if (scopeFlag !== undefined) throw new CliError(`Invalid scope "${String(scopeFlag)}". Use "local" or "global".`)

    if (!context.interactive) return "local"

    return await selectOption("Where should Rueter CLI store its scaffold?", [
        {
            value: "local",
            label: "Local project (.rueter/)",
            hint: "Best when this repo should own its own saved CLI data.",
        },
        {
            value: "global",
            label: "Global user config (~/.config/rueter/)",
            hint: "Best when you want one shared CLI home across projects.",
        },
    ])
}
