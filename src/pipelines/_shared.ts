//
// shared.ts
//
// Rueter AI — Pipelines
//
// Internal utilities shared across all workflow pipelines.
// Not part of the public package API.
//

import * as fs from "node:fs/promises"
import type { Dirent } from "node:fs"
import * as nodePath from "node:path"

export type ProgressCallback = (message: string) => void

// ─── Code Sanitization ────────────────────────────────────────────────────────

/**
 * Strips markdown code fences from model output.
 * Handles both full fenced blocks (```lang ... ```) and stray fence lines.
 */
export function sanitizeCode(raw: string): string {
    const lines = raw.trim().split("\n")
    if (lines[0]?.match(/^```/)) lines.shift()
    if (lines[lines.length - 1]?.match(/^```\s*$/)) lines.pop()
    return lines.join("\n").trim()
}

// ─── Model Calling ────────────────────────────────────────────────────────────

/**
 * Calls a RueterModel and returns the plain text response.
 * Bridges the TypeScript/runtime mismatch: prompt() is typed Promise<ModelResult>
 * but returns a plain string when returnJSON is falsy.
 */
export async function ask(
    model: { prompt(input: string, returnJSON?: boolean): Promise<unknown> },
    input: string
): Promise<string> {
    const result = await model.prompt(input)
    if (typeof result === "string") return result
    const maybe = result as Record<string, unknown>
    if (typeof maybe.res === "string") return maybe.res
    return String(result)
}

/**
 * Calls a model and retries until it returns parseable JSON, or throws after
 * the specified number of attempts.
 */
export async function askForJson<T>(
    model: { prompt(input: string, returnJSON?: boolean): Promise<unknown> },
    input: string,
    retries = 3
): Promise<T> {
    let lastRaw = ""
    for (let attempt = 0; attempt < retries; attempt++) {
        const query = attempt === 0
            ? input
            : `${input}\n\n[IMPORTANT: Your previous response was not valid JSON. Return ONLY the raw JSON — no prose, no markdown fences, no code blocks.]`
        lastRaw = await ask(model, query)
        const parsed = parseJson<T>(lastRaw)
        if (parsed !== null) return parsed
    }
    throw new Error(
        `Model failed to produce valid JSON after ${retries} attempts. ` +
        `Last response: "${lastRaw.slice(0, 300)}"`
    )
}

export function parseJson<T>(raw: string): T | null {
    try {
        const cleaned = raw
            .replace(/^```(?:json)?\s*/m, "")
            .replace(/\s*```\s*$/m, "")
            .trim()
        return JSON.parse(cleaned) as T
    } catch {
        return null
    }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export function extractCritiqueScore(critique: string): number {
    const match = critique.match(/SCORE:\s*(\d+)/i)
    if (!match) return 10
    return Math.min(10, Math.max(1, parseInt(match[1], 10)))
}

// ─── Logging & Time ──────────────────────────────────────────────────────────

export function log(onProgress: ProgressCallback | undefined, message: string): void {
    onProgress?.(message)
}

export function timestamp(): string {
    return new Date().toISOString().replace("T", " ").slice(0, 19)
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

export async function readFileSafe(filePath: string): Promise<string | null> {
    try {
        return await fs.readFile(filePath, "utf-8")
    } catch {
        return null
    }
}

export async function writeFileSafe(filePath: string, content: string): Promise<void> {
    await fs.mkdir(nodePath.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, "utf-8")
}

/** Recursively collects all files with matching extensions, skipping common non-source dirs. */
export async function collectSourceFiles(dir: string, extensions: string[]): Promise<string[]> {
    const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "__pycache__", "coverage", ".turbo"])
    const results: string[] = []

    async function walk(current: string): Promise<void> {
        let entries: Dirent<string>[]
        try {
            entries = await fs.readdir(current, { withFileTypes: true, encoding: "utf-8" })
        } catch {
            return
        }
        for (const entry of entries) {
            const fullPath = nodePath.join(current, entry.name)
            if (entry.isDirectory()) {
                if (!SKIP.has(entry.name)) await walk(fullPath)
            } else if (extensions.some(ext => entry.name.endsWith(ext))) {
                results.push(fullPath)
            }
        }
    }

    await walk(dir)
    return results
}
