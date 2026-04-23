import * as fs from "node:fs/promises"

interface PackageMeta {
    name: string
    version: string
}

let cachedPackageMeta: Promise<PackageMeta> | undefined

export function getPackageMeta(): Promise<PackageMeta> {
    if (!cachedPackageMeta) cachedPackageMeta = readPackageMeta()
    return cachedPackageMeta
}

async function readPackageMeta(): Promise<PackageMeta> {
    const packageJsonUrl = new URL("../../../package.json", import.meta.url)
    const raw = await fs.readFile(packageJsonUrl, "utf8")
    const parsed = JSON.parse(raw) as Partial<PackageMeta>

    return {
        name: parsed.name ?? "rueter-ai",
        version: parsed.version ?? "0.0.0",
    }
}
