import * as fs from "node:fs/promises"
import * as nodePath from "node:path"
import * as os from "node:os"

import { CliError } from "./errors.js"

export type CliScope = "local" | "global"

export interface CliConfigFile {
    version: number
    scope: CliScope
    createdAt: string
    updatedAt: string
    defaults: {
        outputFormat: "pretty"
        interactive: true
    }
}

export interface ScopePathInfo {
    scope: CliScope
    rootDir: string
    configFilePath: string
    exists: boolean
}

export interface InitConfigResult {
    scope: CliScope
    rootDir: string
    configFilePath: string
    createdRootDir: boolean
    createdConfigFile: boolean
    createdDirectories: string[]
}

const CONFIG_DIRS = ["models", "orchestrators", "history", "sessions"] as const

export function getScopePathInfo(scope: CliScope, cwd = process.cwd()): ScopePathInfo {
    const rootDir = getScopeRootDir(scope, cwd)
    return {
        scope,
        rootDir,
        configFilePath: nodePath.join(rootDir, "config.json"),
        exists: false,
    }
}

export async function inspectScopePath(scope: CliScope, cwd = process.cwd()): Promise<ScopePathInfo> {
    const info = getScopePathInfo(scope, cwd)
    return {
        ...info,
        exists: await pathExists(info.rootDir),
    }
}

export async function initializeCliConfig(
    scope: CliScope,
    cwd = process.cwd(),
    force = false
): Promise<InitConfigResult> {
    const rootDir = getScopeRootDir(scope, cwd)
    const configFilePath = nodePath.join(rootDir, "config.json")
    const createdDirectories: string[] = []

    const rootDirExists = await pathExists(rootDir)
    if (!rootDirExists) {
        await fs.mkdir(rootDir, { recursive: true })
    }

    for (const dirName of CONFIG_DIRS) {
        const fullDirPath = nodePath.join(rootDir, dirName)
        const dirExists = await pathExists(fullDirPath)
        if (!dirExists) {
            await fs.mkdir(fullDirPath, { recursive: true })
            createdDirectories.push(fullDirPath)
        }
    }

    const configExists = await pathExists(configFilePath)
    const config = buildConfigFile(scope)
    let createdConfigFile = false

    if (!configExists || force) {
        await fs.writeFile(configFilePath, JSON.stringify(config, null, 2) + "\n", "utf8")
        createdConfigFile = true
    }

    return {
        scope,
        rootDir,
        configFilePath,
        createdRootDir: !rootDirExists,
        createdConfigFile,
        createdDirectories,
    }
}

export async function inspectAllScopes(cwd = process.cwd()): Promise<ScopePathInfo[]> {
    return Promise.all([
        inspectScopePath("local", cwd),
        inspectScopePath("global", cwd),
    ])
}

function getScopeRootDir(scope: CliScope, cwd: string): string {
    if (scope === "local") return nodePath.join(cwd, ".rueter")

    const xdgConfigHome = process.env.XDG_CONFIG_HOME
    if (xdgConfigHome) return nodePath.join(xdgConfigHome, "rueter")

    const homeDir = os.homedir()
    if (!homeDir) throw new CliError("Unable to resolve your home directory for global CLI config.")

    return nodePath.join(homeDir, ".config", "rueter")
}

function buildConfigFile(scope: CliScope): CliConfigFile {
    const now = new Date().toISOString()
    return {
        version: 1,
        scope,
        createdAt: now,
        updatedAt: now,
        defaults: {
            outputFormat: "pretty",
            interactive: true,
        },
    }
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await fs.access(path)
        return true
    } catch {
        return false
    }
}
