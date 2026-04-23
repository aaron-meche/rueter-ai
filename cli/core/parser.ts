import type { CliFlags, CommandContext, CommandDefinition, ParsedInvocation } from "../types.js"

const SHORT_FLAG_ALIASES: Record<string, string> = {
    h: "help",
    v: "version",
    i: "interactive",
    j: "json",
    f: "force",
    y: "yes",
}

const LEADING_GLOBAL_FLAGS = new Set(["help", "version", "interactive", "json", "noColor", "noHistory"])

export function parseInvocation(commands: readonly CommandDefinition[], argv: string[]): ParsedInvocation {
    const { commandArgv, flags: leadingFlags } = extractLeadingGlobalFlags(argv)

    if (leadingFlags.version === true || commandArgv.includes("--version") || commandArgv.includes("-v")) {
        return { kind: "version" }
    }

    if (commandArgv.length === 0) return { kind: "help" }
    if (commandArgv.length === 1 && commandArgv[0] === "help") {
        return { kind: "help" }
    }

    const command = findCommand(commands, commandArgv)
    if (!command) {
        const groupHelpCommand = buildGroupHelpCommand(commands, commandArgv)
        if (groupHelpCommand) return { kind: "help", command: groupHelpCommand }

        return {
            kind: "help",
            error: `Unknown command: ${commandArgv.join(" ")}`,
        }
    }

    const trailingTokens = commandArgv.slice(command.path.length)
    const parsed = parseArgsAndFlags(trailingTokens)
    const flags = { ...leadingFlags, ...parsed.flags }
    const args = parsed.args

    if (flags.help === true) return { kind: "help", command }

    const context: CommandContext = {
        args,
        flags,
        rawArgv: argv,
        interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
        cwd: process.cwd(),
    }

    return {
        kind: "command",
        command,
        context,
    }
}

function extractLeadingGlobalFlags(argv: string[]): { commandArgv: string[]; flags: CliFlags } {
    const flags: CliFlags = {}
    let index = 0

    while (index < argv.length) {
        const token = argv[index]

        if (token === "help") {
            flags.help = true
            index += 1
            continue
        }

        if (token.startsWith("--")) {
            const [rawName, inlineValue] = token.slice(2).split("=", 2)
            const flagName = normalizeFlagName(rawName)
            if (!LEADING_GLOBAL_FLAGS.has(flagName)) break

            flags[flagName] = inlineValue ?? true
            index += 1
            continue
        }

        if (token.startsWith("-") && token !== "-") {
            const shortFlags = token.slice(1).split("")
            const expanded = shortFlags.map(shortFlag => SHORT_FLAG_ALIASES[shortFlag] ?? shortFlag)
            if (!expanded.every(flagName => LEADING_GLOBAL_FLAGS.has(flagName))) break

            for (const flagName of expanded) flags[flagName] = true
            index += 1
            continue
        }

        break
    }

    return {
        commandArgv: argv.slice(index),
        flags,
    }
}

function findCommand(commands: readonly CommandDefinition[], argv: string[]): CommandDefinition | undefined {
    return [...commands]
        .sort((left, right) => right.path.length - left.path.length)
        .find(command => command.path.every((segment, index) => argv[index] === segment))
}

function buildGroupHelpCommand(
    commands: readonly CommandDefinition[],
    argv: readonly string[]
): CommandDefinition | undefined {
    const groupTokens = argv.filter(token => !isGlobalFlagToken(token))
    if (groupTokens.length !== 1) return undefined

    const group = groupTokens[0]
    const groupedCommands = commands
        .filter(command => command.path[0] === group)
        .sort((left, right) => left.path.join(" ").localeCompare(right.path.join(" ")))

    if (groupedCommands.length === 0) return undefined

    return {
        path: [group],
        summary: `Command group with ${groupedCommands.length} subcommands.`,
        description: [
            "Available subcommands:",
            ...groupedCommands.map(command => `  rueter ${command.path.join(" ")} - ${command.summary}`),
        ].join("\n"),
        usage: `rueter ${group} <command> [options]`,
        examples: groupedCommands.slice(0, 4).map(command => `rueter ${command.path.join(" ")}`),
        async run() {
            return 0
        },
    }
}

function isGlobalFlagToken(token: string): boolean {
    if (token === "help") return true

    if (token.startsWith("--")) {
        const [rawName] = token.slice(2).split("=", 2)
        return LEADING_GLOBAL_FLAGS.has(normalizeFlagName(rawName))
    }

    if (token.startsWith("-") && token !== "-") {
        return token
            .slice(1)
            .split("")
            .every(shortFlag => LEADING_GLOBAL_FLAGS.has(SHORT_FLAG_ALIASES[shortFlag] ?? shortFlag))
    }

    return false
}

function parseArgsAndFlags(tokens: string[]): { args: string[]; flags: CliFlags } {
    const args: string[] = []
    const flags: CliFlags = {}

    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index]

        if (!token.startsWith("-") || token === "-") {
            args.push(token)
            continue
        }

        if (token.startsWith("--")) {
            const [rawName, inlineValue] = token.slice(2).split("=", 2)
            const flagName = normalizeFlagName(rawName)

            if (inlineValue !== undefined) {
                flags[flagName] = inlineValue
                continue
            }

            const nextToken = tokens[index + 1]
            if (nextToken !== undefined && !nextToken.startsWith("-")) {
                flags[flagName] = nextToken
                index += 1
                continue
            }

            flags[flagName] = true
            continue
        }

        const shortFlags = token.slice(1).split("")
        for (const shortFlag of shortFlags) {
            const expandedName = SHORT_FLAG_ALIASES[shortFlag] ?? shortFlag
            flags[expandedName] = true
        }
    }

    return { args, flags }
}

function normalizeFlagName(flagName: string): string {
    return flagName.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}
