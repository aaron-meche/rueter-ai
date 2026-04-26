//
// PersonalAuthor.ts
//
// Rueter AI — Pipelines
//
// Reads a personal writing collection from RueterAuthor.md, analyzes the
// user's unique voice, then writes any assignment indistinguishably in that style.
//

import * as nodePath from "node:path"

import {
    instantiateSpecialPreset,
    PromptEnhancerPreset,
    SelfCritiquePreset,
    WritingStyleAnalyzerPreset,
    StyleReplicatorPreset,
} from "../models/SpecialModels.js"

import {
    ask, extractCritiqueScore, log, timestamp,
    readFileSafe, writeFileSafe,
    type ProgressCallback,
} from "./_shared.js"

// ─── Config ───────────────────────────────────────────────────────────────────

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

// ─── Prompt Builders ──────────────────────────────────────────────────────────

function buildReplicationPrompt(styleFingerprint: string, assignment: string): string {
    const div = "═".repeat(60)
    return [
        "STYLE GUIDE:", div, styleFingerprint, div, "",
        "ASSIGNMENT:", div, assignment, div, "",
        "Using the style guide above as your complete creative brief, write the piece now.",
    ].join("\n")
}

function buildRevisionPrompt(
    styleFingerprint: string,
    assignment: string,
    draft: string,
    critique: string
): string {
    const div = "═".repeat(60)
    return [
        "STYLE GUIDE:", div, styleFingerprint, div, "",
        "ASSIGNMENT:", div, assignment, div, "",
        "YOUR PREVIOUS DRAFT:", div, draft, div, "",
        "CRITIQUE OF PREVIOUS DRAFT:", div, critique, div, "",
        "Rewrite the complete piece. Address every weakness identified in the critique while maintaining perfect stylistic fidelity to the style guide.",
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

// ─── Workflow ─────────────────────────────────────────────────────────────────

/**
 * Reads a personal writing collection from RueterAuthor.md, analyzes the user's
 * unique style, then writes the requested assignment indistinguishably in that voice.
 *
 * Pipeline:
 *   1. Read RueterAuthor.md (creates a template if absent)
 *   2. Enhance the assignment prompt → PromptEnhancerPreset
 *   3. Analyze writing style → WritingStyleAnalyzerPreset
 *   4. Write assignment in user's style → StyleReplicatorPreset
 *   5. Critique style fidelity → SelfCritiquePreset
 *   6. Revise if score < 7 → StyleReplicatorPreset (revision pass)
 */
export async function PersonalAuthor(config: PersonalAuthorConfig): Promise<string> {
    const {
        apiKey,
        assignment,
        authorMdPath = nodePath.join(process.cwd(), "RueterAuthor.md"),
        outputPath   = nodePath.join(process.cwd(), "RueterOutput.md"),
        onProgress,
    } = config

    const enhancer   = instantiateSpecialPreset(apiKey, PromptEnhancerPreset)
    const analyzer   = instantiateSpecialPreset(apiKey, WritingStyleAnalyzerPreset)
    const replicator = instantiateSpecialPreset(apiKey, StyleReplicatorPreset)
    const critiquer  = instantiateSpecialPreset(apiKey, SelfCritiquePreset)

    // 1 ─ Load writing samples
    log(onProgress, "Step 1/6 — Loading writing samples…")
    const authorContent = await readFileSafe(authorMdPath)

    if (!authorContent) {
        await writeFileSafe(authorMdPath, buildAuthorMdTemplate())
        log(onProgress, `No RueterAuthor.md found. A template has been created at:\n  ${authorMdPath}\n\nAdd your writing samples to that file, then run PersonalAuthor again.`)
        return ""
    }

    const samplesOnly = authorContent.replace(/^#.*$/m, "").replace(/^>.*$/mg, "").trim()

    if (samplesOnly.length < 200) {
        throw new Error(
            `RueterAuthor.md at "${authorMdPath}" contains too little content for reliable style analysis. ` +
            "Add at least one substantial writing sample (200+ characters) and try again."
        )
    }

    // 2 ─ Enhance the assignment prompt
    log(onProgress, "Step 2/6 — Enhancing assignment prompt…")
    const enhancedAssignment = await ask(enhancer, assignment)

    // 3 ─ Analyze writing style
    log(onProgress, "Step 3/6 — Analyzing writing style…")
    const styleFingerprint = await ask(
        analyzer,
        `Analyze the writing style in the following samples:\n\n${"═".repeat(60)}\n${samplesOnly}\n${"═".repeat(60)}`
    )

    // 4 ─ Write the assignment in the user's style
    log(onProgress, "Step 4/6 — Writing assignment in your style…")
    let draft = await ask(replicator, buildReplicationPrompt(styleFingerprint, enhancedAssignment))

    // 5 ─ Critique style fidelity
    log(onProgress, "Step 5/6 — Evaluating style fidelity…")
    const critique = await ask(critiquer, [
        "Evaluate the following piece against this style guide. Focus on style fidelity, not just quality.",
        "", "STYLE GUIDE:", styleFingerprint,
        "", "PIECE TO EVALUATE:", draft,
    ].join("\n"))

    const score = extractCritiqueScore(critique)
    log(onProgress, `  Style fidelity score: ${score}/10`)

    // 6 ─ Revision pass if fidelity is below threshold
    if (score < 7) {
        log(onProgress, "Step 6/6 — Revising for closer style match…")
        draft = await ask(replicator, buildRevisionPrompt(styleFingerprint, enhancedAssignment, draft, critique))
    } else {
        log(onProgress, "Step 6/6 — Style fidelity is high; no revision needed.")
    }

    await writeFileSafe(outputPath, [
        `# ${assignment.slice(0, 80)}`,
        `> Generated by Rueter AI PersonalAuthor · ${timestamp()}`,
        "", "---", "",
        draft, "",
        "---", `*Style fidelity score: ${score}/10*`,
    ].join("\n"))

    log(onProgress, `\n✅ Done — saved to ${outputPath}`)
    return draft
}
