import * as fs from "node:fs/promises"

import { CliError } from "./errors.js"
import type { CommandContext } from "../types.js"
import { readBooleanFlag, readPromptArgs, readStringFlag } from "./flags.js"
import { promptMultiline } from "../ui/prompt.js"

export async function resolvePromptText(
    context: CommandContext,
    positionalStartIndex = 0,
    label = "Enter your prompt"
): Promise<string> {
    const promptFlag = readStringFlag(context.flags, "prompt")
    if (promptFlag) return promptFlag

    const fileFlag = readStringFlag(context.flags, "file")
    if (fileFlag) {
        const raw = await fs.readFile(fileFlag, "utf8")
        if (raw.trim().length === 0) throw new CliError(`Prompt file "${fileFlag}" is empty.`)
        return raw
    }

    const positionalPrompt = readPromptArgs(context.args, positionalStartIndex)
    if (positionalPrompt) return positionalPrompt

    const forceStdIn = readBooleanFlag(context.flags, "stdin") === true
    if (forceStdIn || !process.stdin.isTTY) {
        const stdinValue = await readStdin()
        if (stdinValue.trim().length === 0) throw new CliError("No prompt text was provided on stdin.")
        return stdinValue
    }

    if (context.interactive) {
        return promptMultiline(label)
    }

    throw new CliError("No prompt text provided. Use --prompt, --file, --stdin, or pass text positionally.")
}

export async function resolveHistoryLines(
    context: CommandContext,
    flagName = "historyFile"
): Promise<string[]> {
    const fileFlag = readStringFlag(context.flags, flagName)
    if (!fileFlag) {
        if (context.interactive) {
            const raw = await promptMultiline("Paste prior writing samples, separated however you like.")
            return splitHistoryText(raw)
        }
        throw new CliError(`No history source provided. Use --${toKebabCase(flagName)} <file>.`)
    }

    const raw = await fs.readFile(fileFlag, "utf8")
    const lines = splitHistoryText(raw)
    if (lines.length === 0) throw new CliError(`History file "${fileFlag}" did not contain any usable samples.`)
    return lines
}

async function readStdin(): Promise<string> {
    const chunks: string[] = []
    for await (const chunk of process.stdin) {
        chunks.push(String(chunk))
    }
    return chunks.join("")
}

function splitHistoryText(raw: string): string[] {
    return raw
        .split(/\n-{3,}\n|\n={3,}\n/g)
        .map(chunk => chunk.trim())
        .filter(Boolean)
}

function toKebabCase(value: string): string {
    return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
