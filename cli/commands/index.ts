import type { CommandDefinition } from "../types.js"
import { askCommand } from "./ask.js"
import { configCommands } from "./config.js"
import { doctorCommand } from "./doctor.js"
import { ghostwriterCommands } from "./ghostwriter.js"
import { historyCommands } from "./history.js"
import { modelCommands } from "./models.js"
import { orchestratorCommands } from "./orchestrators.js"
import { presetCommands } from "./presets.js"
import { workflowCommands } from "./workflows.js"

export const commands: readonly CommandDefinition[] = [
    askCommand,
    doctorCommand,
    ...configCommands,
    ...ghostwriterCommands,
    ...historyCommands,
    ...modelCommands,
    ...orchestratorCommands,
    ...presetCommands,
    ...workflowCommands,
]
