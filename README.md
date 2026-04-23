# Rueter AI

Rueter AI is a TypeScript-first ESM library that gives Anthropic, OpenAI, Google Gemini, and xAI Grok a consistent prompt interface.

The two core primitives are:

- `RueterModel` for a single provider/model instance
- `Rueter` for parallel orchestration across multiple `RueterModel` instances

On top of that core, the package also exports:

- 53 preconfigured specialized model factories
- 5 higher-level workflows
- `GhostWriter`, a convenience helper for writing-style replication

## What It Does

- Normalizes provider request shapes behind a single `.prompt()` API
- Returns plain text or structured result objects with usage cost data
- Lets you fan the same prompt out to multiple models in parallel
- Ships with many task-specific model presets for code, planning, writing, data extraction, and more
- Uses native `fetch` under the hood instead of provider SDKs
- Exports public TypeScript types for the main result/config shapes

## Runtime Requirements

- Node.js 18+ or any runtime with a global `fetch`
- ESM project setup
- API keys for the providers you plan to call

## Installation

```bash
npm install rueter-ai
```

Use whatever environment-loading strategy your app already prefers. The examples below assume API keys are already available on `process.env`.

## Quick Start

### Single model

```ts
import { RueterModel } from "rueter-ai"

const model = new RueterModel("openai", process.env.OPENAI_API_KEY, 2, {
  systemPrompt: "You are concise and technical.",
  temperature: 0.2,
  maxTokens: 512,
})

const text = await model.prompt("What is the capital of Japan?")
console.log(text)

const detailed = await model.prompt("What is the capital of Japan?", true)
console.log(detailed)
```

`model.prompt(prompt)` returns a `string`.

`model.prompt(prompt, true)` returns:

```ts
{
  res: string | null
  cost: {
    model: string
    input: number
    output: number
    total: number
  } | null
  error?: string
}
```

### Multi-model orchestration

```ts
import { Rueter, RueterModel } from "rueter-ai"

const models = [
  new RueterModel("grok", process.env.GROK_API!, 1, {
    temperature: 0,
    maxTokens: 512,
  }),
  new RueterModel("anthropic", process.env.ANTHROPIC_API_KEY!, 2, {
    temperature: 0,
    maxTokens: 512,
  }),
]

const rueter = new Rueter(models, {
  systemPrompt: "Answer briefly and directly.",
  temperature: 0,
  maxTokens: 512,
})

const results = await rueter.prompt("What is the capital of Japan?")
console.log(results)
```

`rueter.prompt(prompt)` returns a `Record<string, ModelResult>` keyed by each model's runtime ID, such as `openai_gpt-5.4` or `grok_grok-4-1-fast-reasoning`.

## Public API

### `RueterModel`

Constructor:

```ts
new RueterModel(provider, apiKey, modelIndex?, config?)
```

Parameters:

- `provider`: `"anthropic" | "openai" | "gemini" | "grok"`
- `apiKey`: provider API key
- `modelIndex`: numeric index into the built-in model catalog for that provider, default `0`
- `config`: optional model settings

Supported config fields:

- `systemPrompt?: string`
- `temperature?: number`
- `maxTokens?: number`
- `topP?: number`
- `topK?: number`
- `frequencyPenalty?: number`
- `presencePenalty?: number`
- `stopSequences?: string[]`
- `n?: number`

Instance methods:

- `prompt(prompt: string): Promise<string>`
- `prompt(prompt: string, returnJSON: true): Promise<ModelResult>`
- `setSystemPrompt(sysPrompt: string): void`
- `setTemperature(temp: number): void`
- `setMaxTokens(maxTok: number): void`
- `getID(): string`

### `Rueter`

Constructor:

```ts
new Rueter(models, config)
```

Parameters:

- `models`: `RueterModel[]`
- `config`: shared config applied across the supplied models

Important: the second argument is required by the current implementation. If you do not want shared overrides, pass `{}`.

Orchestrator methods:

- `prompt(prompt: string): Promise<RueterResults>`
- `addModel(provider, apiKey, modelIndex?): void`
- `setSystemPrompt(sysPrompt: string): void`
- `setTemperature(temp: number): void`
- `setMaxTokens(maxTok: number): void`

Current orchestrator-wide shared settings are limited to:

- `systemPrompt`
- `temperature`
- `maxTokens`

## Built-in Provider Catalog

`modelIndex` selects from the built-in catalog below.

### Anthropic

- `0` -> `claude-haiku-4-5-20251001`
- `1` -> `claude-sonnet-4-5-20250929`
- `2` -> `claude-sonnet-4-6`
- `3` -> `claude-opus-4-6`

### OpenAI

- `0` -> `gpt-5.4-nano`
- `1` -> `gpt-5.4-mini`
- `2` -> `gpt-5.4`
- `3` -> `o3`

### Gemini

- `0` -> `gemini-2.5-flash-lite`
- `1` -> `gemini-2.5-flash`
- `2` -> `gemini-2.5-pro`
- `3` -> `gemini-2.5-pro`

### Grok

- `0` -> `grok-4-1-fast-non-reasoning`
- `1` -> `grok-4-1-fast-reasoning`
- `2` -> `grok-4-fast-reasoning`
- `3` -> `grok-4.20-reasoning`

Note: the current Gemini catalog in source contains `gemini-2.5-pro` at both indices `2` and `3`.

## Cost Tracking

When you call `prompt(..., true)`, Rueter AI calculates usage cost from the provider response and returns a `UsageCost` object:

```ts
{
  model: string
  input: string
  output: string
  total: string
}
```

Values are returned as fixed-precision USD strings.

## Specialized Model Factories

The package currently exports 53 specialized model factories. Each one accepts `apiKey: string` and returns a configured `RueterModel`.

Examples include:

- `CompressorModel`
- `SimpleAnswerModel`
- `TerminalCommandModel`
- `PromptEnhancerModel`
- `KeywordExtractorModel`
- `QuestionExtractorModel`
- `TextFormatterModel`
- `CodeGeneratorModel`
- `RefactorModel`
- `DebugModel`
- `TestGeneratorModel`
- `SecurityAuditorModel`
- `CodeReviewModel`
- `DocumentationModel`
- `CommitMessageModel`
- `CodeExplainerModel`
- `TypeScriptTyperModel`
- `PerformanceAnalyzerModel`
- `FunctionGeneratorModel`
- `ProjectArchitectModel`
- `FilePlannerModel`
- `FileAssemblerModel`
- `ApiExtractorModel`
- `DecomposerModel`
- `PlannerModel`
- `SelfCritiqueModel`
- `SummarizerModel`
- `TranslatorModel`
- `ConceptExplainerModel`
- `RootCauseAnalyzerModel`
- `ArgumentBuilderModel`
- `DecisionAnalyzerModel`
- `DataExtractorModel`
- `JsonResponseModel`
- `SchemaGeneratorModel`
- `SentimentAnalyzerModel`
- `ClassifierModel`
- `EntityExtractorModel`
- `DataTransformerModel`
- `DataValidatorModel`
- `RegexGeneratorModel`
- `SQLGeneratorModel`
- `ApiDesignerModel`
- `GraphQLSchemaModel`
- `OpenApiSpecModel`
- `WritingStyleAnalyzerModel`
- `StyleReplicatorModel`
- `AcademicWriterModel`
- `ResearchOutlinerModel`
- `EmailDrafterModel`
- `TechnicalBlogModel`
- `ChangelogGeneratorModel`
- `ReadmeGeneratorModel`

Example:

```ts
import { PromptEnhancerModel } from "rueter-ai"

const model = PromptEnhancerModel(process.env.GROK_API!)
const res = await model.prompt("Make this prompt stronger", true)
console.log(res)
```

Important: in the current source, all specialized model factories are Grok-backed presets, so they require an xAI/Grok API key.

## Workflows

The package exports these workflow functions:

- `CodeProjectGenerator`
- `BugHunterWorkflow`
- `CodeRefactorWorkflow`
- `ResearchAssistantWorkflow`
- `PersonalAuthor`

These workflows accept config objects, use the specialized models internally, and usually write files to disk while optionally reporting progress through an `onProgress` callback.

### `CodeProjectGenerator`

Creates a project from a high-level prompt and writes generated files plus a project hub markdown file.

```ts
import { CodeProjectGenerator } from "rueter-ai"

await CodeProjectGenerator({
  apiKey: process.env.GROK_API!,
  projectPrompt: "Build a Node.js CLI expense tracker",
  outputDir: "./ledger",
  projectMdPath: "./LedgerProject.md",
  onProgress(message) {
    console.log(message)
  },
})
```

### `BugHunterWorkflow`

Scans a source directory and writes a `RueterBugReport.md` report.

Required config:

- `apiKey`
- `sourceDir`

Optional config:

- `reportPath`
- `extensions`
- `onProgress`

### `CodeRefactorWorkflow`

Refactors every source file in a directory, writes the output to another directory, and can also generate tests.

Required config:

- `apiKey`
- `sourceDir`
- `outputDir`

Optional config:

- `generateTests`
- `reportPath`
- `extensions`
- `onProgress`

### `ResearchAssistantWorkflow`

Generates a research document and writes `RueterResearch.md` by default.

Required config:

- `apiKey`
- `topic`

Optional config:

- `outputPath`
- `sections`
- `onProgress`

### `PersonalAuthor`

Reads or creates `RueterAuthor.md`, analyzes the writing samples in it, and writes a generated piece to `RueterOutput.md` by default.

Required config:

- `apiKey`
- `assignment`

Optional config:

- `authorMdPath`
- `outputPath`
- `onProgress`

Important: the current workflow implementations use the specialized model presets internally, so they also depend on a Grok/xAI API key in the current source.

## `GhostWriter`

The package also exports:

```ts
GhostWriter(apiKey: string, history: string[], prompt: string): Promise<string>
```

This helper analyzes previous writing samples and then generates a new piece in a similar voice using `WritingStyleAnalyzerModel` and `StyleReplicatorModel`.

Example:

```ts
import { GhostWriter } from "rueter-ai"

const history = [
  "Sample one",
  "Sample two",
  "Sample three",
]

const output = await GhostWriter(
  process.env.GROK_API!,
  history,
  "Write a new paragraph in this style about solar energy."
)

console.log(output)
```

Note: the current `GhostWriter` implementation logs the generated style guide and output to the console as part of its execution.

## Exported Types

The package re-exports its public types, including:

- `Provider`
- `ModelInfo`
- `HttpRequestFormat`
- `BuilderConfig`
- `UsageCost`
- `ModelResult`
- `RueterModelConfig`
- `RueterResults`

## Current Notes and Limitations

- The correct `Rueter` constructor is `new Rueter(models, config)`. It is not `new Rueter({ models: [...] })`.
- `Rueter` requires a config object as its second argument in the current implementation. Pass `{}` if you do not want shared overrides.
- `Rueter.addModel()` only accepts `provider`, `apiKey`, and `modelIndex`. If you need advanced per-model config, instantiate `RueterModel` objects manually and pass them into `Rueter`.
- Model selection is currently numeric-index based.
- There is no streaming API yet. Responses are returned only after the full provider response is available.
- Some providers/builders accept `n`, but the current `prompt()` implementation returns only the first textual choice/candidate.
- The core request layer uses native `fetch`, but the package itself is not literally zero-dependency.

## License

MIT
