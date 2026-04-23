import * as fs from "node:fs/promises"
import * as nodePath from "node:path"

import { CliError } from "./errors.js"

export async function pathExists(path: string): Promise<boolean> {
    try {
        await fs.access(path)
        return true
    } catch {
        return false
    }
}

export async function ensureDirectory(path: string): Promise<void> {
    await fs.mkdir(path, { recursive: true })
}

export async function readJsonFile<T>(path: string): Promise<T> {
    try {
        const raw = await fs.readFile(path, "utf8")
        return JSON.parse(raw) as T
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new CliError(`Failed to read JSON file "${path}": ${message}`)
    }
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
    await ensureDirectory(nodePath.dirname(path))
    await fs.writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8")
}

export async function removeFile(path: string): Promise<void> {
    try {
        await fs.unlink(path)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return
        throw error
    }
}

export async function listJsonFiles(directory: string): Promise<string[]> {
    if (!await pathExists(directory)) return []

    const entries = await fs.readdir(directory, { withFileTypes: true })
    return entries
        .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
        .map(entry => nodePath.join(directory, entry.name))
        .sort((left, right) => left.localeCompare(right))
}

export function sanitizeDefinitionName(name: string): string {
    const trimmed = name.trim()
    if (!trimmed) throw new CliError("Definition names cannot be empty.")
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(trimmed)) {
        throw new CliError("Definition names may only use letters, numbers, dashes, and underscores.")
    }
    return trimmed
}
