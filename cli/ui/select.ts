import * as readline from "node:readline"

import type { MultiSelectOption, SelectOption } from "../types.js"
import { CliError } from "../core/errors.js"
import { theme } from "./theme.js"

export async function selectOption<T extends string>(
    message: string,
    options: readonly SelectOption<T>[]
): Promise<T> {
    if (options.length === 0) throw new CliError("Cannot open a selection prompt with no options.")

    if (!process.stdin.isTTY || !process.stdout.isTTY || process.env.TERM === "dumb") {
        return options[0].value
    }

    const stdout = process.stdout
    const stdin = process.stdin
    let selectedIndex = 0
    let renderedLineCount = 0

    const render = (): void => {
        const lines = [
            theme.bold(message),
            theme.muted("Use Up/Down to move, Enter to confirm, Ctrl+C to cancel."),
            "",
        ]

        for (let index = 0; index < options.length; index++) {
            const option = options[index]
            const isSelected = index === selectedIndex
            const label = isSelected ? theme.inverse(`> ${option.label}`) : `  ${option.label}`
            lines.push(label)
            if (option.hint) lines.push(`    ${theme.muted(option.hint)}`)
        }

        if (renderedLineCount > 0) {
            readline.moveCursor(stdout, 0, -renderedLineCount)
            readline.cursorTo(stdout, 0)
            readline.clearScreenDown(stdout)
        }

        stdout.write(lines.join("\n"))
        renderedLineCount = lines.length
    }

    return await new Promise<T>((resolve, reject) => {
        readline.emitKeypressEvents(stdin)
        const previousRawMode = stdin.isRaw === true
        stdin.setRawMode?.(true)

        const cleanup = (): void => {
            stdin.off("keypress", onKeypress)
            stdin.setRawMode?.(previousRawMode)
            stdout.write("\n")
        }

        const onKeypress = (_character: string, key: readline.Key): void => {
            if (key.name === "up" || key.name === "k") {
                selectedIndex = (selectedIndex - 1 + options.length) % options.length
                render()
                return
            }

            if (key.name === "down" || key.name === "j") {
                selectedIndex = (selectedIndex + 1) % options.length
                render()
                return
            }

            if (key.name === "return") {
                const selectedOption = options[selectedIndex]
                cleanup()
                resolve(selectedOption.value)
                return
            }

            if (key.name === "c" && key.ctrl) {
                cleanup()
                reject(new CliError("Selection cancelled.", 130))
            }
        }

        stdin.on("keypress", onKeypress)
        render()
    })
}

export async function multiSelectOptions<T extends string>(
    message: string,
    options: readonly MultiSelectOption<T>[],
    minimumSelected = 1
): Promise<T[]> {
    if (options.length === 0) throw new CliError("Cannot open a multi-select prompt with no options.")
    if (!process.stdin.isTTY || !process.stdout.isTTY || process.env.TERM === "dumb") {
        return options.filter(option => option.selected).map(option => option.value)
    }

    const stdout = process.stdout
    const stdin = process.stdin
    let selectedIndex = 0
    const selectedValues = new Set(options.filter(option => option.selected).map(option => option.value))
    let renderedLineCount = 0

    const render = (): void => {
        const lines = [
            theme.bold(message),
            theme.muted("Use Up/Down to move, Space to toggle, Enter to confirm."),
            "",
        ]

        for (let index = 0; index < options.length; index++) {
            const option = options[index]
            const isCursor = index === selectedIndex
            const checked = selectedValues.has(option.value) ? theme.success("[x]") : theme.muted("[ ]")
            const label = `${checked} ${option.label}`
            lines.push(isCursor ? theme.inverse(`> ${label}`) : `  ${label}`)
            if (option.hint) lines.push(`    ${theme.muted(option.hint)}`)
        }

        if (renderedLineCount > 0) {
            readline.moveCursor(stdout, 0, -renderedLineCount)
            readline.cursorTo(stdout, 0)
            readline.clearScreenDown(stdout)
        }

        stdout.write(lines.join("\n"))
        renderedLineCount = lines.length
    }

    return await new Promise<T[]>((resolve, reject) => {
        readline.emitKeypressEvents(stdin)
        const previousRawMode = stdin.isRaw === true
        stdin.setRawMode?.(true)

        const cleanup = (): void => {
            stdin.off("keypress", onKeypress)
            stdin.setRawMode?.(previousRawMode)
            stdout.write("\n")
        }

        const onKeypress = (_character: string, key: readline.Key): void => {
            if (key.name === "up" || key.name === "k") {
                selectedIndex = (selectedIndex - 1 + options.length) % options.length
                render()
                return
            }

            if (key.name === "down" || key.name === "j") {
                selectedIndex = (selectedIndex + 1) % options.length
                render()
                return
            }

            if (key.name === "space") {
                const option = options[selectedIndex]
                if (selectedValues.has(option.value)) selectedValues.delete(option.value)
                else selectedValues.add(option.value)
                render()
                return
            }

            if (key.name === "return") {
                if (selectedValues.size < minimumSelected) {
                    cleanup()
                    reject(new CliError(`Select at least ${minimumSelected} option${minimumSelected === 1 ? "" : "s"}.`))
                    return
                }

                cleanup()
                resolve(options.filter(option => selectedValues.has(option.value)).map(option => option.value))
                return
            }

            if (key.name === "c" && key.ctrl) {
                cleanup()
                reject(new CliError("Selection cancelled.", 130))
            }
        }

        stdin.on("keypress", onKeypress)
        render()
    })
}
