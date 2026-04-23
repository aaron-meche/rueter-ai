import * as readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"

import { CliError } from "../core/errors.js"

interface TextPromptOptions {
    defaultValue?: string
    allowEmpty?: boolean
}

interface NumberPromptOptions extends TextPromptOptions {
    integer?: boolean
    min?: number
    max?: number
}

export async function promptText(message: string, options: TextPromptOptions = {}): Promise<string> {
    ensureInteractivePrompt()

    const rl = readline.createInterface({ input, output })
    const suffix = options.defaultValue ? ` (${options.defaultValue})` : ""

    try {
        const answer = (await rl.question(`${message}${suffix}: `)).trim()
        const resolved = answer.length > 0 ? answer : options.defaultValue ?? ""

        if (!options.allowEmpty && resolved.trim().length === 0) {
            throw new CliError(`${message} is required.`)
        }

        return resolved
    } finally {
        rl.close()
    }
}

export async function promptNumber(message: string, options: NumberPromptOptions = {}): Promise<number | undefined> {
    const answer = await promptText(message, {
        defaultValue: options.defaultValue,
        allowEmpty: true,
    })

    if (answer.trim().length === 0) return undefined

    const value = Number(answer)
    if (!Number.isFinite(value)) throw new CliError(`${message} must be a valid number.`)
    if (options.integer && !Number.isInteger(value)) throw new CliError(`${message} must be an integer.`)
    if (options.min !== undefined && value < options.min) throw new CliError(`${message} must be at least ${options.min}.`)
    if (options.max !== undefined && value > options.max) throw new CliError(`${message} must be at most ${options.max}.`)

    return value
}

export async function promptConfirm(message: string, defaultValue = true): Promise<boolean> {
    const defaultLabel = defaultValue ? "Y/n" : "y/N"
    const answer = await promptText(`${message} [${defaultLabel}]`, { allowEmpty: true })
    if (answer.trim().length === 0) return defaultValue

    const normalized = answer.trim().toLowerCase()
    if (["y", "yes"].includes(normalized)) return true
    if (["n", "no"].includes(normalized)) return false
    throw new CliError(`${message} expects yes or no.`)
}

export async function promptMultiline(message: string): Promise<string> {
    ensureInteractivePrompt()

    const rl = readline.createInterface({ input, output })
    const lines: string[] = []

    try {
        console.log(message)
        console.log("(Finish with a single line containing /end)")

        while (true) {
            const line = await rl.question("")
            if (line.trim() === "/end") break
            lines.push(line)
        }
    } finally {
        rl.close()
    }

    const value = lines.join("\n").trim()
    if (value.length === 0) throw new CliError("Prompt content cannot be empty.")
    return value
}

function ensureInteractivePrompt(): void {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new CliError("Interactive prompting is not available in this terminal.")
    }
}
