import type { CliFlags, CommandContext, CommandDefinition, ParsedInvocation } from "../types.js"

const SHORT_FLAG_ALIASES: Record<string, string> = {
    h: "help",
    v: "version",
    i: "interactive",
    j: "json",
    f: "force",
    y: "yes",
}

export function parseInvocation(commands: readonly CommandDefinition[], argv: string[]): ParsedInvocation {
    if (argv.length === 0) return { kind: "help" }
    if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help")) {
        return { kind: "help" }
    }

    if (argv.includes("--version") || argv.includes("-v")) return { kind: "version" }

    const command = findCommand(commands, argv)
    if (!command) {
        return {
            kind: "help",
            error: `Unknown command: ${argv.join(" ")}`,
        }
    }

    const trailingTokens = argv.slice(command.path.length)
    const { args, flags } = parseArgsAndFlags(trailingTokens)

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

function findCommand(commands: readonly CommandDefinition[], argv: string[]): CommandDefinition | undefined {
    return [...commands]
        .sort((left, right) => right.path.length - left.path.length)
        .find(command => command.path.every((segment, index) => argv[index] === segment))
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
