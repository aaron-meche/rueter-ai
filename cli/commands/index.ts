import type { CommandDefinition } from "../types.js"
import { configCommands } from "./config.js"
import { doctorCommand } from "./doctor.js"
import { modelCommands } from "./models.js"

export const commands: readonly CommandDefinition[] = [
    doctorCommand,
    ...configCommands,
    ...modelCommands,
]
