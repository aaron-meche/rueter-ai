//
// Workflows
//
// Rueter AI
// written by Aaron Meche
//
// Multi-step AI pipelines that orchestrate Special Models, read/write local
// hub files (RueterProject.md, RueterAuthor.md, etc.), and produce
// professional-grade outputs with persistent progress tracking.
//

import * as fs from "node:fs/promises"
import type { Dirent } from "node:fs"
import * as nodePath from "node:path"

import {
    PromptEnhancerModel,
    CodeGeneratorModel,
    RefactorModel,
    SelfCritiqueModel,
    SecurityAuditorModel,
    DebugModel,
    TestGeneratorModel,
    WritingStyleAnalyzerModel,
    StyleReplicatorModel,
    ProjectArchitectModel,
    ApiExtractorModel,
    AcademicWriterModel,
    ResearchOutlinerModel,
} from "./SpecialModels.js"

// ─── Shared Types ─────────────────────────────────────────────────────────────

/** Receives a human-readable status message after each significant workflow step. */
export type ProgressCallback = (message: string) => void

// ─── CodeProjectGenerator ─────────────────────────────────────────────────────

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

interface ProjectTask {
    id: number
    file: ProjectFile
    status: "pending" | "in_progress" | "complete" | "failed"
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
    /** Called after each step with a status message */
    onProgress?: ProgressCallback
}

// ─── PersonalAuthor ───────────────────────────────────────────────────────────

export interface PersonalAuthorConfig {
    /** xAI API key */
    apiKey: string
    /** Description of the writing assignment to complete */
    assignment: string
    /** Path to RueterAuthor.md containing writing samples (default: ./RueterAuthor.md) */
    authorMdPath?: string
    /** Path to save the generated piece (default: ./RueterOutput.md) */
    outputPath?: string
    /** Called after each step with a status message */
    onProgress?: ProgressCallback
}

// ─── BugHunterWorkflow ────────────────────────────────────────────────────────

export interface BugHunterConfig {
    /** xAI API key */
    apiKey: string
    /** Directory to scan for source files */
    sourceDir: string
    /** Path for the bug report file (default: ./RueterBugReport.md) */
    reportPath?: string
    /** File extensions to scan (default: [".ts", ".js", ".py", ".go"]) */
    extensions?: string[]
    /** Called after each step with a status message */
    onProgress?: ProgressCallback
}

// ─── CodeRefactorWorkflow ─────────────────────────────────────────────────────

export interface CodeRefactorConfig {
    /** xAI API key */
    apiKey: string
    /** Directory containing source files to refactor */
    sourceDir: string
    /** Directory where refactored files will be written */
    outputDir: string
    /** Generate a test file alongside each refactored file (default: true) */
    generateTests?: boolean
    /** Path for the refactor report (default: ./RueterRefactor.md) */
    reportPath?: string
    /** File extensions to include (default: [".ts", ".js"]) */
    extensions?: string[]
    /** Called after each step with a status message */
    onProgress?: ProgressCallback
}

// ─── ResearchAssistantWorkflow ────────────────────────────────────────────────

export interface ResearchAssistantConfig {
    /** xAI API key */
    apiKey: string
    /** Research topic or question */
    topic: string
    /** Path to save the research document (default: ./RueterResearch.md) */
    outputPath?: string
    /** Number of body sections to generate, not counting intro/conclusion (default: 4) */
    sections?: number
    /** Called after each step with a status message */
    onProgress?: ProgressCallback
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface ResearchSection {
    heading: string
    key_points: string[]
}

interface ResearchOutline {
    title: string
    abstract: string
    sections: ResearchSection[]
}

interface BugFinding {
    filePath: string
    logicIssues: string
    securityIssues: string
    hasIssues: boolean
}

interface RefactorResult {
    filePath: string
    outputPath: string
    testPath?: string
    securityIssues: string
    hasSecurityIssues: boolean
}

// ─── Core Utilities ───────────────────────────────────────────────────────────

/**
 * Calls a RueterModel and returns the plain text response.
 * Bridges the TypeScript/runtime type mismatch in RueterModel.prompt:
 * the method signature says ModelResult but returns a string when returnJSON is falsy.
 */
async function ask(
    model: { prompt(input: string, returnJSON?: boolean): Promise<unknown> },
    input: string
): Promise<string> {
    const result = await model.prompt(input)
    if (typeof result === "string") return result
    const maybe = result as Record<string, unknown>
    if (typeof maybe.res === "string") return maybe.res
    return String(result)
}

/**
 * Calls a model and retries until it returns parseable JSON, or throws.
 * Strips markdown code fences before parsing.
 */
async function askForJson<T>(
    model: { prompt(input: string, returnJSON?: boolean): Promise<unknown> },
    input: string,
    retries = 3
): Promise<T> {
    let lastRaw = ""
    for (let attempt = 0; attempt < retries; attempt++) {
        const query = attempt === 0 ? input
            : `${input}\n\n[IMPORTANT: Your previous response was not valid JSON. Return ONLY the raw JSON — no prose, no markdown fences, no code blocks.]`
        lastRaw = await ask(model, query)
        const parsed = parseJson<T>(lastRaw)
        if (parsed !== null) return parsed
    }
    throw new Error(
        `Model failed to produce valid JSON after ${retries} attempts. ` +
        `Last response: "${lastRaw.slice(0, 300)}"`
    )
}

/** Strips markdown code fences and attempts JSON.parse. Returns null on failure. */
function parseJson<T>(raw: string): T | null {
    try {
        const cleaned = raw
            .replace(/^```(?:json)?\s*/m, "")
            .replace(/\s*```\s*$/m, "")
            .trim()
        return JSON.parse(cleaned) as T
    } catch {
        return null
    }
}

/** Extracts the numeric score from a SelfCritiqueModel response. Defaults to 10 if unparseable. */
function extractCritiqueScore(critique: string): number {
    const match = critique.match(/SCORE:\s*(\d+)/i)
    if (!match) return 10
    return Math.min(10, Math.max(1, parseInt(match[1], 10)))
}

function log(onProgress: ProgressCallback | undefined, message: string): void {
    onProgress?.(message)
}

function timestamp(): string {
    return new Date().toISOString().replace("T", " ").slice(0, 19)
}

// ─── File I/O Utilities ───────────────────────────────────────────────────────

async function readFileSafe(filePath: string): Promise<string | null> {
    try {
        return await fs.readFile(filePath, "utf-8")
    } catch {
        return null
    }
}

async function writeFileSafe(filePath: string, content: string): Promise<void> {
    await fs.mkdir(nodePath.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, "utf-8")
}

/** Recursively collects all files with matching extensions, skipping common non-source dirs. */
async function collectSourceFiles(dir: string, extensions: string[]): Promise<string[]> {
    const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "__pycache__", "coverage", ".turbo"])
    const results: string[] = []

    async function walk(current: string): Promise<void> {
        let entries: Dirent<string>[]
        try {
            entries = await fs.readdir(current, { withFileTypes: true, encoding: "utf-8" })
        } catch {
            return
        }
        for (const entry of entries) {
            const fullPath = nodePath.join(current, entry.name)
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) await walk(fullPath)
            } else if (extensions.some(ext => entry.name.endsWith(ext))) {
                results.push(fullPath)
            }
        }
    }

    await walk(dir)
    return results
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

function buildCodePrompt(
    file: ProjectFile,
    arch: ProjectArchitecture,
    generatedApiContext: string[]
): string {
    const divider = "─".repeat(60)
    const contextBlock = generatedApiContext.length > 0
        ? `\n${divider}\nALREADY-IMPLEMENTED FILES (public API only — use for imports and type references):\n${divider}\n${generatedApiContext.join("\n\n")}\n${divider}\n`
        : ""
    const depsNote = file.dependencies.length > 0
        ? `\nDEPENDS ON: ${file.dependencies.join(", ")}`
        : ""

    return [
        `PROJECT: ${arch.title}`,
        `TECH STACK: ${arch.tech_stack.join(", ")}`,
        `ARCHITECTURE: ${arch.architecture_overview}`,
        contextBlock,
        `FILE: ${file.path}`,
        `PURPOSE: ${file.purpose}`,
        `IMPLEMENTATION REQUIREMENTS:\n${file.implementation_context}`,
        depsNote,
        "\nGenerate the complete, production-ready implementation now.",
    ].filter(s => s !== "").join("\n")
}

function buildReplicationPrompt(styleFingerprint: string, enhancedAssignment: string): string {
    const divider = "═".repeat(60)
    return [
        "STYLE GUIDE:",
        divider,
        styleFingerprint,
        divider,
        "",
        "ASSIGNMENT:",
        divider,
        enhancedAssignment,
        divider,
        "",
        "Using the style guide above as your complete creative brief, write the piece now.",
    ].join("\n")
}

function buildRevisionPrompt(
    styleFingerprint: string,
    enhancedAssignment: string,
    draft: string,
    critique: string
): string {
    const divider = "═".repeat(60)
    return [
        "STYLE GUIDE:",
        divider,
        styleFingerprint,
        divider,
        "",
        "ASSIGNMENT:",
        divider,
        enhancedAssignment,
        divider,
        "",
        "YOUR PREVIOUS DRAFT:",
        divider,
        draft,
        divider,
        "",
        "CRITIQUE OF PREVIOUS DRAFT:",
        divider,
        critique,
        divider,
        "",
        "Rewrite the complete piece. Address every weakness identified in the critique while maintaining perfect stylistic fidelity to the style guide.",
    ].join("\n")
}

function buildSectionPrompt(
    outline: ResearchOutline,
    section: ResearchSection,
    sectionIndex: number,
    totalSections: number,
    previousContent: string
): string {
    const contextNote = previousContent.length > 0
        ? `\nPAPER SO FAR (for continuity — do not repeat, just continue):\n${"─".repeat(60)}\n${previousContent.slice(-3000)}\n${"─".repeat(60)}\n`
        : ""

    return [
        `PAPER TITLE: "${outline.title}"`,
        `ABSTRACT: ${outline.abstract}`,
        `SECTION ${sectionIndex + 1} OF ${totalSections}: "${section.heading}"`,
        contextNote,
        "This section must address the following points:",
        section.key_points.map(p => `  • ${p}`).join("\n"),
        "",
        `Write the complete "${section.heading}" section in full academic prose.`,
        `Begin with: ## ${section.heading}`,
    ].join("\n")
}

// ─── Markdown Document Builders ───────────────────────────────────────────────

function taskStatusIcon(status: ProjectTask["status"]): string {
    const icons: Record<ProjectTask["status"], string> = {
        pending:     "⬜",
        in_progress: "🔄",
        complete:    "✅",
        failed:      "❌",
    }
    return icons[status]
}

function buildProjectMd(
    arch: ProjectArchitecture,
    tasks: ProjectTask[],
    projectStatus: "active" | "complete" | "failed",
    buildLog: string[],
    securityAudit?: string
): string {
    const complete = tasks.filter(t => t.status === "complete").length
    const failed   = tasks.filter(t => t.status === "failed").length
    const total    = tasks.length
    const statusIcon = projectStatus === "complete" ? "✅" : projectStatus === "failed" ? "❌" : "🔄"

    const setupBlock = arch.setup_commands.length > 0
        ? ["## Setup", "```bash", ...arch.setup_commands, "```", ""].join("\n")
        : ""

    const fileList = tasks.map(t => {
        const icon = taskStatusIcon(t.status)
        const errorLine = t.error ? `\n> ⚠️ **Error:** ${t.error}` : ""
        return `### ${icon} \`${t.file.path}\`\n> ${t.file.purpose}${errorLine}\n\n**Status:** ${t.status}`
    }).join("\n\n---\n\n")

    const auditBlock = securityAudit
        ? ["## Security Audit", "```", securityAudit, "```", ""].join("\n")
        : ""

    const logBlock = buildLog.length > 0
        ? ["## Build Log", ...buildLog.map(l => `- ${l}`), ""].join("\n")
        : ""

    return [
        `# RueterProject: ${arch.title}`,
        `> Generated by Rueter AI · Last updated: ${timestamp()}`,
        "",
        `## Status ${statusIcon}`,
        `**${complete} / ${total} files generated**${failed > 0 ? ` · ${failed} failed` : ""}`,
        "",
        "## Description",
        arch.description,
        "",
        "## Architecture",
        arch.architecture_overview,
        "",
        "## Tech Stack",
        arch.tech_stack.map(t => `- ${t}`).join("\n"),
        "",
        setupBlock,
        "## File Manifest",
        "",
        fileList,
        "",
        auditBlock,
        logBlock,
    ].join("\n")
}

function buildBugReportMd(
    sourceDir: string,
    findings: BugFinding[],
    isComplete: boolean
): string {
    const withIssues = findings.filter(f => f.hasIssues)
    const statusLine = isComplete
        ? `Scan complete · ${findings.length} files scanned · ${withIssues.length} files with issues`
        : `Scan in progress · ${findings.length} files scanned so far…`

    const findingBlocks = findings.map(f => {
        if (!f.hasIssues) {
            return `### ✅ \`${nodePath.relative(sourceDir, f.filePath)}\`\n\nNo issues found.`
        }
        return [
            `### ⚠️ \`${nodePath.relative(sourceDir, f.filePath)}\``,
            "",
            "#### Logic & Runtime Issues",
            f.logicIssues,
            "",
            "#### Security Issues",
            f.securityIssues,
        ].join("\n")
    }).join("\n\n---\n\n")

    return [
        "# RueterBugReport",
        `> Generated by Rueter AI · ${timestamp()}`,
        `> Source: \`${sourceDir}\``,
        "",
        "## Summary",
        statusLine,
        "",
        "## Findings",
        "",
        findingBlocks || "_No files scanned yet._",
        "",
    ].join("\n")
}

function buildRefactorReportMd(
    sourceDir: string,
    outputDir: string,
    results: RefactorResult[],
    generateTests: boolean
): string {
    const withIssues = results.filter(r => r.hasSecurityIssues)

    const resultBlocks = results.map(r => {
        const relSource = nodePath.relative(sourceDir, r.filePath)
        const relOutput = nodePath.relative(outputDir, r.outputPath)
        const testLine = r.testPath
            ? `\n**Tests:** \`${nodePath.relative(outputDir, r.testPath)}\``
            : ""
        const secBlock = r.hasSecurityIssues
            ? `\n\n**Security findings:**\n\`\`\`\n${r.securityIssues}\n\`\`\``
            : "\n\n**Security:** No issues found."

        return [
            `### ✅ \`${relSource}\``,
            `**Output:** \`${relOutput}\`${testLine}`,
            secBlock,
        ].join("\n")
    }).join("\n\n---\n\n")

    return [
        "# RueterRefactor",
        `> Generated by Rueter AI · ${timestamp()}`,
        `> Source: \`${sourceDir}\` → Output: \`${outputDir}\``,
        "",
        "## Summary",
        `- **Files refactored:** ${results.length}`,
        generateTests ? `- **Test files generated:** ${results.filter(r => r.testPath).length}` : "",
        `- **Files with security issues:** ${withIssues.length}`,
        "",
        "## Results",
        "",
        resultBlocks || "_No files processed yet._",
        "",
    ].filter(line => line !== "").join("\n")
}

function buildResearchMd(outline: ResearchOutline, sections: string[]): string {
    return [
        `# ${outline.title}`,
        `> Generated by Rueter AI Research Assistant · ${timestamp()}`,
        "",
        "## Abstract",
        outline.abstract,
        "",
        "---",
        "",
        ...sections,
        "",
        "---",
        "*Generated by Rueter AI · ResearchAssistantWorkflow*",
    ].join("\n")
}

function buildAuthorMdTemplate(): string {
    return [
        "# RueterAuthor — Writing Samples",
        "",
        "> This file powers the **Rueter AI PersonalAuthor** workflow.",
        "> Add your personal writing samples below to enable style analysis and replication.",
        "> The more varied and numerous your samples, the more accurately your voice will be captured.",
        "> Any type of writing works: essays, emails, blog posts, reports, speeches, stories.",
        "",
        "---",
        "",
        "## Sample: [Give this sample a descriptive title]",
        "",
        "[Paste your writing here. Replace this placeholder entirely.]",
        "",
        "---",
        "",
        "## Sample: [Another title]",
        "",
        "[Your writing here...]",
        "",
        "---",
        "",
    ].join("\n")
}

// ─── CodeProjectGenerator ─────────────────────────────────────────────────────

/**
 * Generates a complete, production-ready code project from a high-level prompt.
 *
 * Pipeline:
 *   1. Enhance prompt → PromptEnhancerModel
 *   2. Design architecture → ProjectArchitectModel (JSON)
 *   3. Initialize RueterProject.md hub with full pending checklist
 *   4. For each file: generate → critique → refactor if needed → write to disk → update hub
 *   5. Accumulate public API context so later files stay consistent with earlier ones
 *   6. Security audit all generated files → append to hub
 *   7. Mark project complete in hub
 */
export async function CodeProjectGenerator(config: CodeProjectConfig): Promise<void> {
    const {
        apiKey,
        projectPrompt,
        outputDir,
        projectMdPath = nodePath.join(process.cwd(), "RueterProject.md"),
        onProgress,
    } = config

    const enhancer   = PromptEnhancerModel(apiKey)
    const architect  = ProjectArchitectModel(apiKey)
    const codeGen    = CodeGeneratorModel(apiKey)
    const critiquer  = SelfCritiqueModel(apiKey)
    const refactorer = RefactorModel(apiKey)
    const extractor  = ApiExtractorModel(apiKey)
    const secAuditor = SecurityAuditorModel(apiKey)

    // 1 ─ Enhance the project prompt
    log(onProgress, "Step 1/5 — Enhancing project prompt…")
    const enhancedPrompt = await ask(enhancer, projectPrompt)

    // 2 ─ Generate project architecture as structured JSON
    log(onProgress, "Step 2/5 — Designing project architecture…")
    const architecture = await askForJson<ProjectArchitecture>(architect, enhancedPrompt)

    if (!Array.isArray(architecture.files) || architecture.files.length === 0) {
        throw new Error("ProjectArchitectModel returned an architecture with no files.")
    }

    // 3 ─ Initialize task list and write the hub file
    const tasks: ProjectTask[] = architecture.files.map((file, idx) => ({
        id: idx + 1,
        file,
        status: "pending",
    }))

    const buildLog: string[] = [`${timestamp()} 🚀 Project initialized: ${architecture.title}`]
    log(onProgress, `Step 3/5 — Initializing hub at ${projectMdPath}`)
    await writeFileSafe(projectMdPath, buildProjectMd(architecture, tasks, "active", buildLog))

    // 4 ─ Generate each file in dependency order
    log(onProgress, `Step 4/5 — Generating ${tasks.length} files…`)

    const generatedApiContext: string[] = []

    for (const task of tasks) {
        const label = `[${task.id}/${tasks.length}] ${task.file.path}`
        log(onProgress, `  Generating ${label}…`)

        task.status = "in_progress"
        await writeFileSafe(projectMdPath, buildProjectMd(architecture, tasks, "active", buildLog))

        try {
            // Generate initial implementation
            const codePrompt = buildCodePrompt(task.file, architecture, generatedApiContext)
            let code = await ask(codeGen, codePrompt)

            // Critique quality; refactor if below threshold
            const critique = await ask(critiquer, code)
            const score = extractCritiqueScore(critique)

            if (score < 8) {
                log(onProgress, `    Refactoring ${task.file.path} (quality score: ${score}/10)…`)
                code = await ask(refactorer, `${critique}\n\n${"─".repeat(40)}\n\nCode to refactor:\n${code}`)
            }

            // Write the file to the output directory
            const absolutePath = nodePath.join(outputDir, task.file.path)
            await writeFileSafe(absolutePath, code)

            // Extract public API for use as context in subsequent file generation
            const apiSignature = await ask(extractor, code)
            generatedApiContext.push(`// ${task.file.path}\n${apiSignature}`)

            task.status = "complete"
            buildLog.push(`${timestamp()} ✅ ${task.file.path}`)
            log(onProgress, `    ✅ ${task.file.path}`)

        } catch (err) {
            task.status = "failed"
            task.error = err instanceof Error ? err.message : String(err)
            buildLog.push(`${timestamp()} ❌ ${task.file.path} — ${task.error}`)
            log(onProgress, `    ❌ Failed: ${task.file.path} — ${task.error}`)
        }

        await writeFileSafe(projectMdPath, buildProjectMd(architecture, tasks, "active", buildLog))
    }

    // 5 ─ Security audit all successfully generated files
    log(onProgress, "Step 5/5 — Running security audit on generated codebase…")

    const completedFiles = tasks.filter(t => t.status === "complete")
    let securityAudit: string | undefined

    if (completedFiles.length > 0) {
        const codeBundle = (await Promise.all(
            completedFiles.map(async t => {
                const content = await readFileSafe(nodePath.join(outputDir, t.file.path))
                return content ? `// ── FILE: ${t.file.path} ──\n${content}` : null
            })
        )).filter((c): c is string => c !== null)

        securityAudit = await ask(secAuditor, codeBundle.join("\n\n"))
        buildLog.push(`${timestamp()} 🔒 Security audit complete`)
    }

    // Final hub update
    const allComplete = tasks.every(t => t.status === "complete")
    const finalStatus = allComplete ? "complete" : tasks.some(t => t.status === "failed") ? "active" : "active"
    await writeFileSafe(projectMdPath, buildProjectMd(architecture, tasks, finalStatus, buildLog, securityAudit))

    const complete = tasks.filter(t => t.status === "complete").length
    const failed   = tasks.filter(t => t.status === "failed").length
    log(onProgress, `\n🎉 Done — ${complete} files generated, ${failed} failed`)
    log(onProgress, `Hub:    ${projectMdPath}`)
    log(onProgress, `Output: ${outputDir}`)
}

// ─── PersonalAuthor ───────────────────────────────────────────────────────────

/**
 * Reads a personal writing collection from RueterAuthor.md, analyzes the user's
 * unique style, then writes the requested assignment indistinguishably in that voice.
 *
 * Pipeline:
 *   1. Read RueterAuthor.md (creates template if absent)
 *   2. Enhance the assignment prompt → PromptEnhancerModel
 *   3. Analyze writing style → WritingStyleAnalyzerModel
 *   4. Write assignment in user's style → StyleReplicatorModel
 *   5. Critique style fidelity → SelfCritiqueModel
 *   6. Revise if score < 7 → StyleReplicatorModel (revision pass)
 *   7. Save result to outputPath and return the generated text
 */
export async function PersonalAuthor(config: PersonalAuthorConfig): Promise<string> {
    const {
        apiKey,
        assignment,
        authorMdPath = nodePath.join(process.cwd(), "RueterAuthor.md"),
        outputPath   = nodePath.join(process.cwd(), "RueterOutput.md"),
        onProgress,
    } = config

    const enhancer   = PromptEnhancerModel(apiKey)
    const analyzer   = WritingStyleAnalyzerModel(apiKey)
    const replicator = StyleReplicatorModel(apiKey)
    const critiquer  = SelfCritiqueModel(apiKey)

    // 1 ─ Load writing samples
    log(onProgress, "Step 1/6 — Loading writing samples…")
    let authorContent = await readFileSafe(authorMdPath)

    if (!authorContent) {
        const template = buildAuthorMdTemplate()
        await writeFileSafe(authorMdPath, template)
        log(onProgress, `No RueterAuthor.md found. A template has been created at:\n  ${authorMdPath}\n\nAdd your writing samples to that file, then run PersonalAuthor again.`)
        return ""
    }

    // Strip the template header/instructions to isolate actual writing samples
    const samplesOnly = authorContent
        .replace(/^#.*$/m, "")
        .replace(/^>.*$/mg, "")
        .trim()

    if (samplesOnly.length < 200) {
        throw new Error(
            `RueterAuthor.md at "${authorMdPath}" contains too little content for reliable style analysis. ` +
            "Add at least one substantial writing sample (200+ characters) and try again."
        )
    }

    // 2 ─ Enhance the assignment prompt
    log(onProgress, "Step 2/6 — Enhancing assignment prompt…")
    const enhancedAssignment = await ask(enhancer, assignment)

    // 3 ─ Analyze writing style from the samples
    log(onProgress, "Step 3/6 — Analyzing writing style…")
    const styleFingerprint = await ask(
        analyzer,
        `Analyze the writing style in the following samples:\n\n${"═".repeat(60)}\n${samplesOnly}\n${"═".repeat(60)}`
    )

    // 4 ─ Write the assignment in the user's style
    log(onProgress, "Step 4/6 — Writing assignment in your style…")
    let draft = await ask(replicator, buildReplicationPrompt(styleFingerprint, enhancedAssignment))

    // 5 ─ Critique style fidelity and quality
    log(onProgress, "Step 5/6 — Evaluating style fidelity…")
    const critiquePrompt = [
        "Evaluate the following piece against this style guide. Focus on style fidelity, not just quality.",
        "",
        "STYLE GUIDE:",
        styleFingerprint,
        "",
        "PIECE TO EVALUATE:",
        draft,
    ].join("\n")

    const critique = await ask(critiquer, critiquePrompt)
    const score = extractCritiqueScore(critique)
    log(onProgress, `  Style fidelity score: ${score}/10`)

    // 6 ─ Revision pass if fidelity is below threshold
    if (score < 7) {
        log(onProgress, "Step 6/6 — Revising for closer style match…")
        draft = await ask(
            replicator,
            buildRevisionPrompt(styleFingerprint, enhancedAssignment, draft, critique)
        )
    } else {
        log(onProgress, "Step 6/6 — Style fidelity is high; no revision needed.")
    }

    // Save result
    const outputContent = [
        `# ${assignment.slice(0, 80)}`,
        `> Generated by Rueter AI PersonalAuthor · ${timestamp()}`,
        "",
        "---",
        "",
        draft,
        "",
        "---",
        `*Style fidelity score: ${score}/10*`,
    ].join("\n")

    await writeFileSafe(outputPath, outputContent)
    log(onProgress, `\n✅ Done — saved to ${outputPath}`)

    return draft
}

// ─── BugHunterWorkflow ────────────────────────────────────────────────────────

/**
 * Scans a source directory for logic bugs and security vulnerabilities,
 * producing a comprehensive RueterBugReport.md with per-file findings.
 *
 * Pipeline (per file):
 *   1. Read source file
 *   2. Logic & runtime analysis → DebugModel
 *   3. Security analysis → SecurityAuditorModel
 *   4. Append findings to report, update file on disk after each scan
 */
export async function BugHunterWorkflow(config: BugHunterConfig): Promise<void> {
    const {
        apiKey,
        sourceDir,
        reportPath = nodePath.join(process.cwd(), "RueterBugReport.md"),
        extensions = [".ts", ".js", ".py", ".go"],
        onProgress,
    } = config

    const debugger_  = DebugModel(apiKey)
    const secAuditor = SecurityAuditorModel(apiKey)

    // Collect files
    log(onProgress, `Collecting source files in ${sourceDir}…`)
    const files = await collectSourceFiles(sourceDir, extensions)

    if (files.length === 0) {
        throw new Error(`No files found in "${sourceDir}" with extensions: ${extensions.join(", ")}`)
    }

    log(onProgress, `Found ${files.length} files to scan.`)

    const findings: BugFinding[] = []

    // Write initial report
    await writeFileSafe(reportPath, buildBugReportMd(sourceDir, findings, false))

    // Scan each file
    for (let i = 0; i < files.length; i++) {
        const filePath = files[i]
        const relPath  = nodePath.relative(sourceDir, filePath)
        log(onProgress, `  [${i + 1}/${files.length}] Scanning ${relPath}…`)

        const content = await readFileSafe(filePath)
        if (!content || content.trim().length === 0) {
            findings.push({ filePath, logicIssues: "File is empty.", securityIssues: "N/A", hasIssues: false })
            continue
        }

        const fileContext = `// FILE: ${relPath}\n${content}`

        const [logicIssues, securityIssues] = await Promise.all([
            ask(debugger_,  `Analyze this file for logic errors, runtime bugs, and incorrect behavior:\n\n${fileContext}`),
            ask(secAuditor, fileContext),
        ])

        // Heuristic: if both outputs contain no finding keywords, mark as clean
        const issueKeywords = /SEVERITY|ROOT CAUSE|bug|error|vulnerability|issue|risk|flaw|insecure|injection/i
        const hasIssues = issueKeywords.test(logicIssues) || issueKeywords.test(securityIssues)

        findings.push({ filePath, logicIssues, securityIssues, hasIssues })

        // Update report after every file so progress is always visible on disk
        await writeFileSafe(reportPath, buildBugReportMd(sourceDir, findings, false))
    }

    // Write final report
    await writeFileSafe(reportPath, buildBugReportMd(sourceDir, findings, true))

    const withIssues = findings.filter(f => f.hasIssues).length
    log(onProgress, `\n✅ Scan complete — ${files.length} files scanned, ${withIssues} with issues`)
    log(onProgress, `Report: ${reportPath}`)
}

// ─── CodeRefactorWorkflow ─────────────────────────────────────────────────────

/**
 * Refactors every source file in a directory, writing improved versions to an
 * output directory while optionally generating a test file for each one.
 * A RueterRefactor.md report summarizes all changes and security findings.
 *
 * Pipeline (per file):
 *   1. Read source file
 *   2. Refactor → RefactorModel
 *   3. Security check on refactored code → SecurityAuditorModel
 *   4. (Optional) Generate tests → TestGeneratorModel
 *   5. Write outputs, update report
 */
export async function CodeRefactorWorkflow(config: CodeRefactorConfig): Promise<void> {
    const {
        apiKey,
        sourceDir,
        outputDir,
        generateTests = true,
        reportPath    = nodePath.join(process.cwd(), "RueterRefactor.md"),
        extensions    = [".ts", ".js"],
        onProgress,
    } = config

    const refactorer = RefactorModel(apiKey)
    const secAuditor = SecurityAuditorModel(apiKey)
    const testGen    = TestGeneratorModel(apiKey)

    // Collect files
    log(onProgress, `Collecting source files in ${sourceDir}…`)
    const files = await collectSourceFiles(sourceDir, extensions)

    if (files.length === 0) {
        throw new Error(`No files found in "${sourceDir}" with extensions: ${extensions.join(", ")}`)
    }

    log(onProgress, `Found ${files.length} files to refactor.`)

    const results: RefactorResult[] = []

    for (let i = 0; i < files.length; i++) {
        const filePath = files[i]
        const relPath  = nodePath.relative(sourceDir, filePath)
        log(onProgress, `  [${i + 1}/${files.length}] Refactoring ${relPath}…`)

        const content = await readFileSafe(filePath)
        if (!content || content.trim().length === 0) {
            log(onProgress, `    Skipped (empty file)`)
            continue
        }

        // Mirror the source directory structure in the output directory
        const outputFilePath = nodePath.join(outputDir, relPath)

        try {
            // Refactor
            const refactored = await ask(
                refactorer,
                `Refactor the following file. Preserve exact runtime behavior.\n\n// FILE: ${relPath}\n${content}`
            )

            // Security audit of the refactored code
            const secAudit = await ask(secAuditor, `// FILE: ${relPath}\n${refactored}`)
            const issueKeywords = /SEVERITY|vulnerability|injection|insecure|flaw/i
            const hasSecurityIssues = issueKeywords.test(secAudit)

            // Write refactored file
            await writeFileSafe(outputFilePath, refactored)

            const result: RefactorResult = {
                filePath,
                outputPath: outputFilePath,
                securityIssues: secAudit,
                hasSecurityIssues,
            }

            // Generate tests if requested
            if (generateTests) {
                log(onProgress, `    Generating tests for ${relPath}…`)
                const tests = await ask(
                    testGen,
                    `Generate comprehensive tests for the following code.\n\n// FILE: ${relPath}\n${refactored}`
                )

                // Place test file adjacent to the refactored output
                const ext      = nodePath.extname(outputFilePath)
                const testPath = outputFilePath.slice(0, -ext.length) + ".test" + ext
                await writeFileSafe(testPath, tests)
                result.testPath = testPath
            }

            results.push(result)
            log(onProgress, `    ✅ ${relPath}`)

        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            log(onProgress, `    ❌ Failed: ${relPath} — ${message}`)
        }

        // Update report after every file
        await writeFileSafe(reportPath, buildRefactorReportMd(sourceDir, outputDir, results, generateTests))
    }

    // Final report
    await writeFileSafe(reportPath, buildRefactorReportMd(sourceDir, outputDir, results, generateTests))

    const testCount = results.filter(r => r.testPath).length
    log(onProgress, `\n✅ Done — ${results.length} files refactored${generateTests ? `, ${testCount} test files generated` : ""}`)
    log(onProgress, `Output:  ${outputDir}`)
    log(onProgress, `Report:  ${reportPath}`)
}

// ─── ResearchAssistantWorkflow ────────────────────────────────────────────────

/**
 * Produces a complete, well-structured research document on any topic.
 *
 * Pipeline:
 *   1. Enhance topic prompt → PromptEnhancerModel
 *   2. Generate structured JSON outline → ResearchOutlinerModel
 *   3. Write each section sequentially with prior context → AcademicWriterModel
 *   4. Assemble complete document, save after each section for live progress
 *   5. Critique full paper → SelfCritiqueModel
 *   6. Revision pass on any section scoring below threshold → AcademicWriterModel
 *   7. Save final document to outputPath
 */
export async function ResearchAssistantWorkflow(config: ResearchAssistantConfig): Promise<string> {
    const {
        apiKey,
        topic,
        outputPath = nodePath.join(process.cwd(), "RueterResearch.md"),
        sections   = 4,
        onProgress,
    } = config

    const enhancer   = PromptEnhancerModel(apiKey)
    const outliner   = ResearchOutlinerModel(apiKey)
    const writer     = AcademicWriterModel(apiKey)
    const critiquer  = SelfCritiqueModel(apiKey)

    // 1 ─ Enhance topic
    log(onProgress, "Step 1/5 — Enhancing research topic…")
    const enhancedTopic = await ask(
        enhancer,
        `Transform this into a precise, well-scoped academic research topic suitable for a ${sections + 2}-section paper: ${topic}`
    )

    // 2 ─ Generate JSON outline
    log(onProgress, "Step 2/5 — Generating research outline…")
    const outline = await askForJson<ResearchOutline>(
        outliner,
        `Generate a research paper outline for the following topic. Include exactly ${sections + 2} sections (Introduction + ${sections} body sections + Conclusion).\n\nTopic: ${enhancedTopic}`
    )

    if (!Array.isArray(outline.sections) || outline.sections.length === 0) {
        throw new Error("ResearchOutlinerModel returned an outline with no sections.")
    }

    log(onProgress, `  Outline: "${outline.title}" · ${outline.sections.length} sections`)

    // 3 & 4 ─ Write each section, saving progress to disk after each one
    log(onProgress, `Step 3/5 — Writing ${outline.sections.length} sections…`)

    const writtenSections: string[] = []

    for (let i = 0; i < outline.sections.length; i++) {
        const section = outline.sections[i]
        log(onProgress, `  [${i + 1}/${outline.sections.length}] Writing "${section.heading}"…`)

        const previousContent = writtenSections.join("\n\n")
        const sectionContent = await ask(
            writer,
            buildSectionPrompt(outline, section, i, outline.sections.length, previousContent)
        )

        writtenSections.push(sectionContent)

        // Save partial document so the user sees live progress
        await writeFileSafe(outputPath, buildResearchMd(outline, writtenSections))
    }

    // 5 ─ Critique the full paper
    log(onProgress, "Step 4/5 — Evaluating paper quality…")
    const fullDraft = writtenSections.join("\n\n")
    const critique = await ask(critiquer, `Critique this academic paper:\n\n${fullDraft}`)
    const score = extractCritiqueScore(critique)
    log(onProgress, `  Quality score: ${score}/10`)

    // 6 ─ Revision pass for each section flagged as weak, if overall score is low
    if (score < 7) {
        log(onProgress, "Step 5/5 — Revising underperforming sections…")

        for (let i = 0; i < outline.sections.length; i++) {
            const section = outline.sections[i]
            const sectionCritiquePrompt = [
                `The following section of a research paper received a low overall quality score (${score}/10).`,
                `Critique this specific section, then rewrite it to be significantly better.`,
                `Paper title: "${outline.title}"`,
                "",
                `SECTION: "${section.heading}"`,
                writtenSections[i],
                "",
                "Overall paper critique for context:",
                critique,
                "",
                `Now rewrite the "${section.heading}" section. Begin with: ## ${section.heading}`,
            ].join("\n")

            writtenSections[i] = await ask(writer, sectionCritiquePrompt)
        }

        await writeFileSafe(outputPath, buildResearchMd(outline, writtenSections))
        log(onProgress, "  Revision complete.")
    } else {
        log(onProgress, "Step 5/5 — Paper quality is high; no revision needed.")
    }

    // Final save
    const finalDocument = buildResearchMd(outline, writtenSections)
    await writeFileSafe(outputPath, finalDocument)

    log(onProgress, `\n✅ Done — research document saved to ${outputPath}`)
    return finalDocument
}
