export type CliFlagValue = boolean | string | undefined
export type CliFlags = Record<string, CliFlagValue>

export interface CliOptionHelp {
    flag: string
    description: string
}

export interface CommandContext {
    args: string[]
    flags: CliFlags
    rawArgv: string[]
    interactive: boolean
    cwd: string
}

export interface CommandDefinition {
    path: readonly string[]
    summary: string
    description?: string
    usage?: string
    options?: readonly CliOptionHelp[]
    examples?: readonly string[]
    run(context: CommandContext): Promise<number | void>
}

export interface SelectOption<T extends string> {
    value: T
    label: string
    hint?: string
}

export type ParsedInvocation =
    | { kind: "command"; command: CommandDefinition; context: CommandContext }
    | { kind: "help"; command?: CommandDefinition; error?: string }
    | { kind: "version" }
