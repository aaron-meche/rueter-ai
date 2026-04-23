import * as nodePath from "node:path"

import { getScopePathInfo, initializeCliConfig } from "./config.js"
import { listJsonFiles, readJsonFile, removeFile, writeJsonFile } from "./files.js"
import type { CliScope, CommandContext, HistoryEntry, HistoryRecord, HistoryTargetType } from "../types.js"

export interface HistoryInput {
    targetType: HistoryTargetType
    targetName: string
    provider?: HistoryEntry["target"]["provider"]
    modelName?: string
    prompt?: string
    durationMs?: number
    result?: unknown
}

export interface ListHistoryOptions {
    scope?: CliScope
    limit?: number
}

const DEFAULT_HISTORY_LIMIT = 20

export async function recordHistory(context: CommandContext, input: HistoryInput): Promise<HistoryRecord | undefined> {
    if (context.flags.noHistory === true) return undefined

    await initializeCliConfig("local", context.cwd)

    const entry = buildHistoryEntry(context, input)
    const filePath = nodePath.join(getHistoryDirectory("local", context.cwd), `${entry.id}.json`)

    await writeJsonFile(filePath, entry)

    return {
        scope: "local",
        filePath,
        entry,
    }
}

export async function listHistory(
    cwd: string,
    options: ListHistoryOptions = {}
): Promise<HistoryRecord[]> {
    const scopes = options.scope ? [options.scope] : (["local", "global"] as const)
    const records: HistoryRecord[] = []

    for (const scope of scopes) {
        const directory = getHistoryDirectory(scope, cwd)
        const files = await listJsonFiles(directory)

        for (const filePath of files) {
            const entry = await readJsonFile<HistoryEntry>(filePath)
            records.push({ scope, filePath, entry })
        }
    }

    return records
        .sort((left, right) => right.entry.createdAt.localeCompare(left.entry.createdAt))
        .slice(0, options.limit ?? DEFAULT_HISTORY_LIMIT)
}

export async function resolveHistoryRecord(cwd: string, idPrefix: string): Promise<HistoryRecord | undefined> {
    const records = await listHistory(cwd, { limit: Number.MAX_SAFE_INTEGER })
    return records.find(record => record.entry.id.startsWith(idPrefix))
}

export async function clearHistory(cwd: string, scope: CliScope = "local"): Promise<number> {
    const directory = getHistoryDirectory(scope, cwd)
    const files = await listJsonFiles(directory)

    await Promise.all(files.map(filePath => removeFile(filePath)))

    return files.length
}

function buildHistoryEntry(context: CommandContext, input: HistoryInput): HistoryEntry {
    const createdAt = new Date().toISOString()
    const id = `${formatHistoryTimestamp(createdAt)}-${makeShortId()}`

    return {
        version: 1,
        id,
        command: context.rawArgv,
        target: {
            type: input.targetType,
            name: input.targetName,
            provider: input.provider,
            modelName: input.modelName,
        },
        prompt: input.prompt,
        durationMs: input.durationMs,
        result: input.result,
        cwd: context.cwd,
        createdAt,
    }
}

function getHistoryDirectory(scope: CliScope, cwd: string): string {
    const rootDir = getScopePathInfo(scope, cwd).rootDir
    return nodePath.join(rootDir, "history")
}

function formatHistoryTimestamp(value: string): string {
    return value.replace(/[-:.TZ]/g, "")
}

function makeShortId(): string {
    return Math.random().toString(36).slice(2, 8)
}
