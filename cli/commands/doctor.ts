import { getCatalogModelCount, getProviderSummaries } from "../core/catalog.js"
import { inspectAllScopes } from "../core/config.js"
import { getProviderEnvStatuses } from "../core/env.js"
import { getPackageMeta } from "../core/package-meta.js"
import { renderHeader, renderJson, renderKeyValueRows, renderStatus, renderSubsection } from "../ui/render.js"
import type { CommandDefinition } from "../types.js"

export const doctorCommand: CommandDefinition = {
    path: ["doctor"],
    summary: "Inspect runtime, config locations, and provider readiness.",
    description: "Shows the package version, terminal capabilities, config directories, API key availability, and the built-in provider/model catalog summary.",
    usage: "rueter doctor [--json]",
    options: [
        { flag: "--json", description: "Output the doctor report as JSON." },
    ],
    examples: [
        "rueter doctor",
        "rueter doctor --json",
    ],
    async run(context) {
        const packageMeta = await getPackageMeta()
        const scopes = await inspectAllScopes(context.cwd)
        const envStatuses = getProviderEnvStatuses()
        const providerSummaries = getProviderSummaries()
        const report = {
            package: packageMeta,
            nodeVersion: process.version,
            cwd: context.cwd,
            interactiveTerminal: context.interactive,
            configScopes: scopes,
            apiKeys: envStatuses,
            catalog: {
                providers: providerSummaries,
                totalModels: getCatalogModelCount(),
            },
        }

        if (context.flags.json === true) {
            console.log(renderJson(report))
            return 0
        }

        const scopeRows = scopes.map(scope => ({
            label: `${scope.scope} config`,
            value: `${renderStatus(scope.exists)}  ${scope.rootDir}`,
        }))

        const apiRows = envStatuses.map(status => ({
            label: `${status.provider} keys`,
            value: `${renderStatus(status.ready)}  ${status.envVars.join(" or ")}`,
        }))

        const providerRows = providerSummaries.map(summary => ({
            label: summary.provider,
            value: `${summary.count} model${summary.count === 1 ? "" : "s"}`,
        }))

        console.log([
            renderHeader("Rueter CLI Doctor", `rueter-ai v${packageMeta.version}`),
            renderSubsection("Runtime"),
            renderKeyValueRows([
                { label: "node", value: process.version },
                { label: "cwd", value: context.cwd },
                { label: "interactive", value: renderStatus(context.interactive, "yes", "no") },
            ]),
            "",
            renderSubsection("Config"),
            renderKeyValueRows(scopeRows),
            "",
            renderSubsection("API Keys"),
            renderKeyValueRows(apiRows),
            "",
            renderSubsection("Built-in Catalog"),
            renderKeyValueRows([
                { label: "total models", value: String(report.catalog.totalModels) },
                ...providerRows,
            ]),
        ].join("\n"))

        return 0
    },
}
