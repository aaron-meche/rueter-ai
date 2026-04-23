import * as specialModels from "../../src/models/SpecialModels.js"
import type { RueterModel } from "../../src/models/RueterModel.js"

import { CliError } from "./errors.js"

export interface PresetDefinition {
    key: string
    exportName: string
    label: string
    create(apiKey: string): RueterModel
}

const presetRegistry = Object.entries(specialModels)
    .filter((entry): entry is [string, (apiKey: string) => RueterModel] => {
        const [name, value] = entry
        return name.endsWith("Model") && typeof value === "function"
    })
    .map(([exportName, create]) => ({
        key: toKebabCase(exportName.replace(/Model$/, "")),
        exportName,
        label: humanizeExportName(exportName.replace(/Model$/, "")),
        create,
    }))
    .sort((left, right) => left.key.localeCompare(right.key))

export function listPresets(): readonly PresetDefinition[] {
    return presetRegistry
}

export function resolvePreset(key: string): PresetDefinition {
    const match = presetRegistry.find(preset => preset.key === key)
    if (!match) throw new CliError(`Unknown preset "${key}". Run "rueter presets list" to see available presets.`)
    return match
}

function toKebabCase(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
        .toLowerCase()
        .replace("graph-ql", "graphql")
        .replace("type-script", "typescript")
        .replace("open-api", "openapi")
}

function humanizeExportName(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
        .replace("Graph QL", "GraphQL")
        .replace("Type Script", "TypeScript")
        .replace("Open Api", "OpenAPI")
        .replace("Api ", "API ")
        .replace("Json", "JSON")
        .replace("Sql", "SQL")
}
