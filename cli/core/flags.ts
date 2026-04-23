import { CliError } from "./errors.js"
import type { CliFlagValue, CliFlags } from "../types.js"

export function readStringFlag(flags: CliFlags, key: string): string | undefined {
    const value = flags[key]
    if (value === undefined) return undefined
    if (typeof value !== "string") throw new CliError(`Flag "--${toKebabCase(key)}" expects a value.`)
    return value
}

export function readRequiredStringFlag(flags: CliFlags, key: string, message?: string): string {
    const value = readStringFlag(flags, key)
    if (!value) throw new CliError(message ?? `Flag "--${toKebabCase(key)}" is required.`)
    return value
}

export function readBooleanFlag(flags: CliFlags, key: string): boolean | undefined {
    const value = flags[key]
    if (value === undefined) return undefined
    if (typeof value === "boolean") return value

    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false

    throw new CliError(`Flag "--${toKebabCase(key)}" expects a boolean value.`)
}

export function readNumberFlag(flags: CliFlags, key: string): number | undefined {
    const value = flags[key]
    if (value === undefined) return undefined
    if (typeof value === "boolean") throw new CliError(`Flag "--${toKebabCase(key)}" expects a numeric value.`)

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) throw new CliError(`Flag "--${toKebabCase(key)}" expects a numeric value.`)
    return parsed
}

export function readIntegerFlag(flags: CliFlags, key: string): number | undefined {
    const value = readNumberFlag(flags, key)
    if (value === undefined) return undefined
    if (!Number.isInteger(value)) throw new CliError(`Flag "--${toKebabCase(key)}" expects an integer value.`)
    return value
}

export function readCsvFlag(flags: CliFlags, key: string): string[] | undefined {
    const value = readStringFlag(flags, key)
    if (value === undefined) return undefined
    return value
        .split(",")
        .map(part => part.trim())
        .filter(Boolean)
}

export function requirePositionalArg(args: readonly string[], index: number, label: string): string {
    const value = args[index]
    if (!value) throw new CliError(`Missing ${label}.`)
    return value
}

export function readPromptArgs(args: readonly string[], startIndex = 0): string | undefined {
    const remaining = args.slice(startIndex).join(" ").trim()
    return remaining.length > 0 ? remaining : undefined
}

function toKebabCase(value: string): string {
    return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
