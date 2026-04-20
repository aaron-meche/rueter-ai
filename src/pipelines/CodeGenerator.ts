//
// CodeGenerator.ts
//
// Rueter AI — Pipelines
//
// CodeProjectGenerator: breaks a project description into individual functions,
// generates them all in parallel, assembles each file, and tracks progress in a
// RueterProject.md hub with per-function checklists.
//

import * as nodePath from "node:path"

import {
    PromptEnhancerModel,
    CodeGeneratorModel,
    ProjectArchitectModel,
    ApiExtractorModel,
    FilePlannerModel,
    FunctionGeneratorModel,
    FileAssemblerModel,
    SecurityAuditorModel,
} from "../models/SpecialModels.js"

import {
    ask, askForJson, sanitizeCode, log, timestamp,
    readFileSafe, writeFileSafe,
    type ProgressCallback,
} from "./_shared.js"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectFile {
    path: string
    purpose: string
    implementation_context: string
    dependencies: string[]
}

interface ProjectArchitecture {
    title: string
    description: string
    tech_stack: string[]
    architecture_overview: string
    setup_commands: string[]
    files: ProjectFile[]
}

interface FunctionSpec {
    name: string
    signature: string
    description: string
    context: string
}

interface FunctionStatus {
    name: string
    signature: string
    status: "pending" | "complete" | "failed"
    error?: string
}

interface FileTask {
    id: number
    file: ProjectFile
    /** Display-level function tracking for the hub. Populated after planning. */
    functions: FunctionStatus[]
    /** Full specs from FilePlannerModel. Used during generation. */
    specs: FunctionSpec[]
    status: "pending" | "planning" | "generating" | "assembling" | "complete" | "failed"
    error?: string
}

export interface CodeProjectConfig {
    /** xAI API key */
    apiKey: string
    /** High-level description of the project to build */
    projectPrompt: string
    /** Directory where generated source files will be written */
    outputDir: string
    /** Path to the RueterProject.md hub file (default: ./RueterProject.md) */
    projectMdPath?: string
    /** Called after each significant step with a status message */
    onProgress?: ProgressCallback
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true for config/data/markup files that need no function-level planning. */
function isPlainFile(filePath: string): boolean {
    const base      = nodePath.basename(filePath)
    const ext       = nodePath.extname(filePath).toLowerCase()
    const plainExts = new Set([".json", ".yml", ".yaml", ".toml", ".ini", ".md", ".txt", ".lock"])
    const plainBase = new Set(["Dockerfile", "Makefile", ".gitignore", ".gitattributes",
                               ".editorconfig", ".prettierrc", ".eslintrc", ".babelrc", ".npmrc"])
    if (plainExts.has(ext)) return true
    if (base.startsWith(".env")) return true
    return plainBase.has(base)
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

function buildFilePlanPrompt(file: ProjectFile, arch: ProjectArchitecture): string {
    const deps = file.dependencies.length > 0 ? `\nDEPENDS ON: ${file.dependencies.join(", ")}` : ""
    return [
        `PROJECT: ${arch.title}`,
        `TECH STACK: ${arch.tech_stack.join(", ")}`,
        `ARCHITECTURE: ${arch.architecture_overview}`,
        "",
        `FILE TO PLAN: ${file.path}`,
        `PURPOSE: ${file.purpose}`,
        `REQUIREMENTS:\n${file.implementation_context}`,
        deps,
        "",
        "Output the JSON function plan now.",
    ].filter(Boolean).join("\n")
}

function buildFunctionPrompt(
    spec: FunctionSpec,
    file: ProjectFile,
    arch: ProjectArchitecture,
    apiContext: string
): string {
    const div = "─".repeat(50)
    const ctx = apiContext
        ? `\nAVAILABLE APIS (already-implemented files — use for imports):\n${div}\n${apiContext}\n${div}\n`
        : ""
    return [
        `PROJECT: ${arch.title}  |  TECH STACK: ${arch.tech_stack.join(", ")}`,
        `FILE: ${file.path}`,
        ctx,
        "IMPLEMENT THIS FUNCTION:",
        `  Signature:   ${spec.signature}`,
        `  Description: ${spec.description}`,
        `  Context:     ${spec.context}`,
        "",
        "Output only the function implementation.",
    ].join("\n")
}

function buildAssemblerPrompt(
    file: ProjectFile,
    arch: ProjectArchitecture,
    functions: Array<{ spec: FunctionSpec; code: string }>,
    apiContext: string
): string {
    const div  = "─".repeat(50)
    const deps = file.dependencies.length > 0 ? `\nIMPORTS FROM: ${file.dependencies.join(", ")}` : ""
    const ctx  = apiContext ? `\nAVAILABLE APIS:\n${div}\n${apiContext}\n${div}\n` : ""
    const fnBlocks = functions
        .map(({ spec, code }, i) => `${div}\n// [${i + 1}] ${spec.signature}\n${div}\n${code}`)
        .join("\n\n")

    return [
        `PROJECT: ${arch.title}  |  TECH STACK: ${arch.tech_stack.join(", ")}`,
        `ASSEMBLE FILE: ${file.path}`,
        `PURPOSE: ${file.purpose}`,
        deps, ctx,
        `Combine these ${functions.length} function implementations into the complete file:`,
        "", fnBlocks, div, "",
        "Output the complete, final file contents.",
    ].filter(Boolean).join("\n")
}

function buildPlainFilePrompt(file: ProjectFile, arch: ProjectArchitecture): string {
    const deps = file.dependencies.length > 0 ? `\nDEPENDS ON: ${file.dependencies.join(", ")}` : ""
    return [
        `PROJECT: ${arch.title}`,
        `TECH STACK: ${arch.tech_stack.join(", ")}`,
        `ARCHITECTURE: ${arch.architecture_overview}`,
        "",
        `FILE: ${file.path}`,
        `PURPOSE: ${file.purpose}`,
        `REQUIREMENTS:\n${file.implementation_context}`,
        deps, "",
        "Generate the complete file contents now.",
    ].filter(Boolean).join("\n")
}

// ─── Hub Markdown Builder ─────────────────────────────────────────────────────

const FILE_STATUS_ICON: Record<FileTask["status"], string> = {
    pending:    "⬜",
    planning:   "📋",
    generating: "⚙️",
    assembling: "🔧",
    complete:   "✅",
    failed:     "❌",
}

function buildProjectMd(
    arch: ProjectArchitecture,
    tasks: FileTask[],
    projectStatus: "active" | "complete" | "failed",
    buildLog: string[],
    securityAudit?: string
): string {
    const complete   = tasks.filter(t => t.status === "complete").length
    const failed     = tasks.filter(t => t.status === "failed").length
    const statusIcon = projectStatus === "complete" ? "✅" : projectStatus === "failed" ? "❌" : "🔄"

    const setupBlock = arch.setup_commands.length > 0
        ? "## Setup\n```bash\n" + arch.setup_commands.join("\n") + "\n```\n"
        : ""

    const fileManifest = tasks.map(task => {
        const icon    = FILE_STATUS_ICON[task.status]
        const errLine = task.error ? `\n> ⚠️ **Error:** ${task.error}` : ""
        const fnBlock = task.functions.length > 0
            ? "\n\n**Functions:**\n" + task.functions.map(fn => {
                const fnIcon = fn.status === "complete" ? "✅" : fn.status === "failed" ? "❌" : "⬜"
                const fnErr  = fn.error ? ` *(${fn.error.slice(0, 100)})*` : ""
                return `  - ${fnIcon} \`${fn.signature}\`${fnErr}`
              }).join("\n")
            : ""
        return `### ${icon} \`${task.file.path}\`\n> ${task.file.purpose}${errLine}${fnBlock}\n\n**Status:** ${task.status}`
    }).join("\n\n---\n\n")

    const auditBlock = securityAudit
        ? "## Security Audit\n```\n" + securityAudit + "\n```\n"
        : ""

    const logBlock = buildLog.length > 0
        ? "## Build Log\n" + buildLog.map(l => `- ${l}`).join("\n") + "\n"
        : ""

    return [
        `# RueterProject: ${arch.title}`,
        `> Generated by Rueter AI · Last updated: ${timestamp()}`,
        "",
        `## Status ${statusIcon}`,
        `**${complete} / ${tasks.length} files generated**${failed > 0 ? ` · ${failed} failed` : ""}`,
        "",
        "## Description", arch.description,
        "", "## Architecture", arch.architecture_overview,
        "", "## Tech Stack", arch.tech_stack.map(t => `- ${t}`).join("\n"),
        "", setupBlock,
        "## File Manifest", "", fileManifest, "",
        auditBlock, logBlock,
    ].join("\n")
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

/**
 * Generates a complete, production-ready code project from a high-level prompt.
 *
 * Pipeline:
 *   1. Enhance prompt → PromptEnhancerModel
 *   2. Design architecture → ProjectArchitectModel (structured JSON)
 *   3. Plan all files in parallel → FilePlannerModel (all files simultaneously)
 *   4. Write initial hub file with full per-function checklists
 *   5. Generate each file in dependency order:
 *        a. Generate all functions in parallel → FunctionGeneratorModel
 *        b. Log each function as it completes
 *        c. Assemble complete file → FileAssemblerModel
 *        d. Write to disk, extract API context, update hub after each file
 *   6. Security audit all generated files → SecurityAuditorModel
 */
export async function CodeProjectGenerator(config: CodeProjectConfig): Promise<void> {
    const {
        apiKey,
        projectPrompt,
        outputDir,
        projectMdPath = nodePath.join(process.cwd(), "RueterProject.md"),
        onProgress,
    } = config

    const enhancer    = PromptEnhancerModel(apiKey)
    const architect   = ProjectArchitectModel(apiKey)
    const filePlanner = FilePlannerModel(apiKey)
    const funcGen     = FunctionGeneratorModel(apiKey)
    const assembler   = FileAssemblerModel(apiKey)
    const plainGen    = CodeGeneratorModel(apiKey)
    const extractor   = ApiExtractorModel(apiKey)
    const secAuditor  = SecurityAuditorModel(apiKey)

    // 1 ─ Enhance prompt
    log(onProgress, "Step 1/6 — Enhancing project prompt…")
    const enhancedPrompt = await ask(enhancer, projectPrompt)

    // 2 ─ Design architecture
    log(onProgress, "Step 2/6 — Designing project architecture…")
    const arch = await askForJson<ProjectArchitecture>(architect, enhancedPrompt)

    if (!Array.isArray(arch.files) || arch.files.length === 0) {
        throw new Error("ProjectArchitectModel returned an architecture with no files.")
    }

    const tasks: FileTask[] = arch.files.map((file, idx) => ({
        id: idx + 1, file, functions: [], specs: [], status: "pending",
    }))

    const buildLog: string[] = [`${timestamp()} 🚀 Project initialized: ${arch.title}`]

    // 3 ─ Plan all files in parallel
    log(onProgress, `Step 3/6 — Planning functions for ${tasks.length} files in parallel…`)

    await Promise.all(tasks.map(async (task) => {
        if (isPlainFile(task.file.path)) {
            log(onProgress, `  ⌥  ${task.file.path} — plain file, no function planning needed`)
            return
        }

        task.status = "planning"

        try {
            const plan = await askForJson<{ functions: FunctionSpec[] }>(
                filePlanner,
                buildFilePlanPrompt(task.file, arch)
            )
            task.specs     = plan.functions ?? []
            task.functions = task.specs.map(f => ({ name: f.name, signature: f.signature, status: "pending" as const }))
            log(onProgress, `  📋 ${task.file.path} — ${task.specs.length} functions planned`)
        } catch {
            log(onProgress, `  ⚠️  ${task.file.path} — planning failed, will use single-pass generation`)
        }

        task.status = "pending"
    }))

    // 4 ─ Write initial hub with full per-function checklists
    log(onProgress, `Step 4/6 — Writing hub to ${projectMdPath}`)
    await writeFileSafe(projectMdPath, buildProjectMd(arch, tasks, "active", buildLog))

    // 5 ─ Generate each file in dependency order
    log(onProgress, `Step 5/6 — Generating ${tasks.length} files…`)

    const generatedApiContext: string[] = []

    for (const task of tasks) {
        log(onProgress, `\n  ▶ [${task.id}/${tasks.length}] ${task.file.path}`)

        const apiContext = generatedApiContext.join("\n\n")

        try {
            let finalCode: string

            if (isPlainFile(task.file.path) || task.specs.length === 0) {
                // ── Single-pass generation (plain files or planning fallback) ──
                task.status = "generating"
                await writeFileSafe(projectMdPath, buildProjectMd(arch, tasks, "active", buildLog))

                const raw = await ask(plainGen, buildPlainFilePrompt(task.file, arch))
                finalCode = sanitizeCode(raw)

            } else {
                // ── Function-level parallel decomposition ──
                task.status = "generating"
                await writeFileSafe(projectMdPath, buildProjectMd(arch, tasks, "active", buildLog))

                // All functions generated simultaneously; each logs as it completes
                const genResults = await Promise.all(
                    task.specs.map(async (spec, i) => {
                        const fnStatus = task.functions[i]
                        log(onProgress, `    → ${spec.name}…`)
                        try {
                            const code = sanitizeCode(await ask(funcGen, buildFunctionPrompt(spec, task.file, arch, apiContext)))
                            fnStatus.status = "complete"
                            log(onProgress, `    ✅ ${spec.name}`)
                            return { spec, code, ok: true as const }
                        } catch (err) {
                            fnStatus.status = "failed"
                            fnStatus.error  = err instanceof Error ? err.message : String(err)
                            log(onProgress, `    ❌ ${spec.name} — ${fnStatus.error}`)
                            return { spec, code: "", ok: false as const }
                        }
                    })
                )

                const successful = genResults.filter(r => r.ok).map(r => ({ spec: r.spec, code: r.code }))

                if (successful.length === 0) throw new Error("All function generation attempts failed.")

                // Update hub with per-function results, then assemble
                await writeFileSafe(projectMdPath, buildProjectMd(arch, tasks, "active", buildLog))

                task.status = "assembling"
                await writeFileSafe(projectMdPath, buildProjectMd(arch, tasks, "active", buildLog))
                log(onProgress, `    🔧 Assembling ${task.file.path} from ${successful.length} functions…`)

                const raw = await ask(assembler, buildAssemblerPrompt(task.file, arch, successful, apiContext))
                finalCode = sanitizeCode(raw)
            }

            // Write to disk and extract public API for subsequent files
            await writeFileSafe(nodePath.join(outputDir, task.file.path), finalCode)
            const apiSignature = await ask(extractor, finalCode)
            generatedApiContext.push(`// ${task.file.path}\n${apiSignature}`)

            task.status = "complete"
            buildLog.push(`${timestamp()} ✅ ${task.file.path}`)
            log(onProgress, `  ✅ ${task.file.path}`)

        } catch (err) {
            task.status = "failed"
            task.error  = err instanceof Error ? err.message : String(err)
            buildLog.push(`${timestamp()} ❌ ${task.file.path} — ${task.error}`)
            log(onProgress, `  ❌ Failed: ${task.file.path} — ${task.error}`)
        }

        await writeFileSafe(projectMdPath, buildProjectMd(arch, tasks, "active", buildLog))
    }

    // 6 ─ Security audit all generated files
    log(onProgress, "\nStep 6/6 — Running security audit…")

    const completedTasks = tasks.filter(t => t.status === "complete")
    let securityAudit: string | undefined

    if (completedTasks.length > 0) {
        const bundle = (await Promise.all(
            completedTasks.map(async t => {
                const content = await readFileSafe(nodePath.join(outputDir, t.file.path))
                return content ? `// ── FILE: ${t.file.path} ──\n${content}` : null
            })
        )).filter((c): c is string => c !== null)

        securityAudit = await ask(secAuditor, bundle.join("\n\n"))
        buildLog.push(`${timestamp()} 🔒 Security audit complete`)
    }

    const finalStatus = tasks.every(t => t.status === "complete") ? "complete" : "active"
    await writeFileSafe(projectMdPath, buildProjectMd(arch, tasks, finalStatus, buildLog, securityAudit))

    const doneCount   = tasks.filter(t => t.status === "complete").length
    const failedCount = tasks.filter(t => t.status === "failed").length
    log(onProgress, `\n🎉 Done — ${doneCount} files generated, ${failedCount} failed`)
    log(onProgress, `Hub:    ${projectMdPath}`)
    log(onProgress, `Output: ${outputDir}`)
}
