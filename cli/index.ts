#!/usr/bin/env node

import { commands } from "./commands/index.js"
import { CliError } from "./core/errors.js"
import { getPackageMeta } from "./core/package-meta.js"
import { parseInvocation } from "./core/parser.js"
import { renderCommandHelp, renderHeader, renderJson, renderRootHelp } from "./ui/render.js"
import { theme } from "./ui/theme.js"

async function main(): Promise<void> {
    const invocation = parseInvocation(commands, process.argv.slice(2))

    if (invocation.kind === "version") {
        const packageMeta = await getPackageMeta()
        console.log(`${packageMeta.name} v${packageMeta.version}`)
        return
    }

    if (invocation.kind === "help") {
        const packageMeta = await getPackageMeta()
        if (invocation.error) {
            console.error([
                renderHeader("Rueter CLI"),
                theme.danger(invocation.error),
                "",
                invocation.command
                    ? renderCommandHelp(invocation.command)
                    : renderRootHelp(packageMeta.version, commands),
            ].join("\n"))
            process.exitCode = 1
            return
        }

        console.log(
            invocation.command
                ? renderCommandHelp(invocation.command)
                : renderRootHelp(packageMeta.version, commands)
        )
        return
    }

    try {
        const exitCode = await invocation.command.run(invocation.context)
        process.exitCode = exitCode ?? 0
    } catch (error) {
        const jsonMode = invocation.context.flags.json === true
        if (error instanceof CliError) {
            if (jsonMode) {
                console.error(renderJson({ error: error.message, exitCode: error.exitCode }))
            } else {
                console.error([
                    renderHeader("Rueter CLI Error"),
                    theme.danger(error.message),
                ].join("\n"))
            }
            process.exitCode = error.exitCode
            return
        }

        const message = error instanceof Error ? error.message : String(error)
        if (jsonMode) {
            console.error(renderJson({ error: message, exitCode: 1 }))
        } else {
            console.error([
                renderHeader("Rueter CLI Error"),
                theme.danger(message),
            ].join("\n"))
        }
        process.exitCode = 1
    }
}

void main()
