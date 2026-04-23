const ANSI = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    gray: "\x1b[90m",
    inverse: "\x1b[7m",
} as const

export const theme = {
    accent: (value: string) => colorize(ANSI.cyan, value),
    success: (value: string) => colorize(ANSI.green, value),
    warning: (value: string) => colorize(ANSI.yellow, value),
    danger: (value: string) => colorize(ANSI.red, value),
    muted: (value: string) => colorize(ANSI.gray, value),
    bold: (value: string) => colorize(ANSI.bold, value),
    dim: (value: string) => colorize(ANSI.dim, value),
    inverse: (value: string) => colorize(ANSI.inverse, value),
}

export function stripAnsi(value: string): string {
    return value.replace(/\x1b\[[0-9;]*m/g, "")
}

export function rule(char = "=", length = 72): string {
    return char.repeat(length)
}

export function padRight(value: string, width: number): string {
    const visibleLength = stripAnsi(value).length
    if (visibleLength >= width) return value
    return value + " ".repeat(width - visibleLength)
}

function colorize(code: string, value: string): string {
    if (!supportsColor()) return value
    return `${code}${value}${ANSI.reset}`
}

function supportsColor(): boolean {
    return Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined
}
