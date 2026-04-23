# Rueter CLI Roadmap

## Recommendation

Build the CLI in **Node.js + TypeScript**.

That is the best fit for this project for four reasons:

- `rueter-ai` is already a TypeScript + ESM package.
- The CLI will need to reuse existing types and internal package structures such as `Provider`, `RueterModelConfig`, the provider model catalog, and workflow config types.
- A CLI has a lot of flag parsing, config validation, and data-shape handling; TypeScript will prevent a lot of avoidable bugs.
- You can still ship plain JavaScript to npm after compilation, so you keep the runtime simple while making development safer.

If you are most comfortable in JavaScript, TypeScript is still the right choice here because it is just JavaScript with guardrails, and it matches the codebase we will be extending later.

## Terminal Stack Recommendation

Use a small, practical Node CLI stack instead of a heavy full-screen TUI on day one.

- Language/runtime: TypeScript on Node 18+.
- Command parser: `commander`.
- Interactive prompts: `@clack/prompts` or `prompts`.
- Validation: `zod`.
- Styling: `picocolors`.
- Loading states: `ora`.
- Env loading: existing `dotenv` dependency.

Do **not** start with `ink` unless we later decide we want a true full-screen terminal app. The "Codex terminal" feel is mostly good layout, spacing, muted color, progress indicators, and thoughtful result rendering. We can get that without making the CLI harder to build.

## Source-Based Reality Check

This roadmap is based on the current source, not just the README.

### 1. `RueterModel` today

In `src/models/RueterModel.ts`, a `RueterModel` is created like this:

```ts
new RueterModel(provider, apiKey, modelIndex, config)
```

Important behavior:

- `provider` must be one of: `anthropic`, `openai`, `gemini`, `grok`.
- The actual model is selected by **numeric index** from `src/const/Models.ts`.
- `config` can include:
  - `systemPrompt`
  - `temperature`
  - `maxTokens`
  - `topP`
  - `topK`
  - `frequencyPenalty`
  - `presencePenalty`
  - `stopSequences`
  - `n`
- `.prompt(prompt)` returns a plain string.
- `.prompt(prompt, true)` returns `{ res, cost }`.
- `.getID()` returns a stable runtime label in the form `provider_modelName`.

### 2. `Rueter` today

In `src/models/Rueter.ts`, the orchestrator is currently:

```ts
new Rueter(models, config)
```

Important behavior:

- It accepts an array of already-created `RueterModel` instances.
- `.prompt(prompt)` fans the prompt out to all models in parallel.
- The result is a map keyed by `model.getID()`.
- Errors are captured per model instead of crashing the whole orchestration.
- Orchestrator-wide setters only cover:
  - `systemPrompt`
  - `temperature`
  - `maxTokens`

This means the CLI should build orchestrators from saved model definitions, instantiate each `RueterModel` with its full config, and only use orchestrator-level overrides for the three supported shared settings.

### 3. Important package constraints that affect the CLI

- The README quick start currently does **not** match the real `Rueter` constructor signature. The CLI should follow the source, not the README.
- Model selection is index-based today, which is brittle if provider model order changes.
- `Rueter.addModel()` only supports `provider`, `apiKey`, and `modelIndex`; it cannot pass advanced config. The CLI should avoid relying on `addModel()` for saved advanced models.
- There is **no streaming API** today. `RueterModel.prompt()` waits for the full response. The first CLI version should render final responses cleanly, not promise token streaming.
- The special model factories in `src/models/SpecialModels.ts` are currently all preconfigured `RueterModel("grok", apiKey, 1, ...)` wrappers. So preset-model and workflow commands should be described as Grok-backed unless the core library changes.

## Product Goal

Build a polished terminal interface for `rueter-ai` that can:

- Prompt a single provider/model ad hoc.
- Persist named `RueterModel` definitions and reuse them later.
- Persist named orchestrators that reference multiple saved models.
- Run orchestrators and compare multiple AI responses in one terminal view.
- Show cost data returned by `rueter-ai`.
- Support both human-friendly terminal output and machine-friendly JSON output.
- Offer a clean interactive setup flow with a terminal style that feels deliberate and premium.
- Later expose the existing preset models and workflow pipelines from the package.

## Design Principle

The CLI should treat saved models and orchestrators as **configuration**, not generated source code.

That is the right mental model because:

- `RueterModel` and `Rueter` are runtime objects.
- The user wants to create them individually from the terminal.
- Serializing definitions to disk is much more useful than generating TS files for every new model/orchestrator.
- It keeps the CLI scriptable, editable, and reusable across projects.

So the CLI should save model/orchestrator definitions, then instantiate live `RueterModel` and `Rueter` objects from those definitions when commands run.

## Core CLI Capability Set

### Phase-1 must-have capabilities

1. Initialize CLI config storage.
2. List supported providers and model catalog entries from `src/const/Models.ts`.
3. Create a named saved `RueterModel`.
4. List, inspect, test, run, and delete saved models.
5. Create a named saved orchestrator from multiple saved models.
6. List, inspect, run, and delete orchestrators.
7. Run one-off prompts without saving anything.
8. Render result text, cost, and errors in a readable terminal layout.
9. Output the same results as JSON for scripting.

### Phase-2 capabilities

1. Interactive chat mode for a saved model or saved orchestrator.
2. Session history and transcript saving.
3. Preset model commands for `SpecialModels.ts`.
4. Workflow commands for existing pipelines such as:
   - `CodeProjectGenerator`
   - `BugHunterWorkflow`
   - `CodeRefactorWorkflow`
   - `ResearchAssistantWorkflow`
   - `PersonalAuthor`

### Phase-3 capabilities

1. Shell completion.
2. Config import/export.
3. Better result filtering and formatting options.
4. True streaming, but only if the core library is extended first.

## Proposed Command Surface

### Foundation

```bash
rueter --help
rueter doctor
rueter config init
rueter config path
```

### Catalog and discovery

```bash
rueter providers list
rueter models catalog
rueter models catalog --provider openai
rueter presets list
rueter workflows list
```

### Saved model management

```bash
rueter models create
rueter models create --name openai-main --provider openai --model gpt-5.4 --api-key-env OPENAI_API_KEY
rueter models list
rueter models show openai-main
rueter models run openai-main --prompt "Explain TCP in 3 sentences."
rueter models chat openai-main
rueter models test openai-main
rueter models delete openai-main
```

### Saved orchestrator management

```bash
rueter orchestrators create
rueter orchestrators create --name frontier-compare --models openai-main,claude-main,grok-fast
rueter orchestrators list
rueter orchestrators show frontier-compare
rueter orchestrators run frontier-compare --prompt "Design a rate limiter."
rueter orchestrators chat frontier-compare
rueter orchestrators delete frontier-compare
```

### One-off execution

```bash
rueter ask --provider grok --model grok-4-1-fast-reasoning --api-key-env GROK_API --prompt "Summarize this file"
rueter ask --model openai-main --file ./prompt.txt
rueter ask --orchestrator frontier-compare --stdin
```

### Presets and workflows

```bash
rueter presets run prompt-enhancer --prompt "make this prompt better"
rueter presets run simple-answer --prompt "capital of Japan"
rueter workflows run bug-hunter --source-dir src
rueter workflows run research-assistant --topic "vector databases"
```

## Config and Storage Strategy

Use layered configuration so the CLI works both globally and per project.

- Global scope: `~/.config/rueter/`
- Local scope: `<project>/.rueter/`

Resolution order:

1. Current project `.rueter/`
2. Global config directory

Add a `--scope local|global` flag to all create/delete/edit commands.

### Proposed file layout

```text
.rueter/
  config.json
  models/
    openai-main.json
    claude-main.json
    grok-fast.json
  orchestrators/
    frontier-compare.json
    cheap-triad.json
  history/
    2026-04-22T12-30-00_openai-main.json
  sessions/
    current-session.json
```

### Saved model schema

```json
{
  "name": "openai-main",
  "provider": "openai",
  "modelName": "gpt-5.4",
  "modelIndex": 2,
  "apiKeyEnv": "OPENAI_API_KEY",
  "config": {
    "systemPrompt": "You are concise and technical.",
    "temperature": 0.2,
    "maxTokens": 2048,
    "topP": 1,
    "frequencyPenalty": 0,
    "presencePenalty": 0,
    "stopSequences": [],
    "n": 1
  }
}
```

Store both `modelName` and `modelIndex`.

At runtime:

1. Resolve by `provider + modelName` first.
2. Fall back to `modelIndex` only if needed.
3. Error clearly if the model no longer exists in the provider catalog.

This avoids long-term breakage from model-order changes.

### Saved orchestrator schema

```json
{
  "name": "frontier-compare",
  "models": ["openai-main", "claude-main", "grok-fast"],
  "config": {
    "systemPrompt": "Answer like a senior engineer.",
    "temperature": 0,
    "maxTokens": 1500
  },
  "output": {
    "defaultFormat": "pretty",
    "showCosts": true,
    "showErrors": true
  }
}
```

Important: keep orchestrator config limited to the fields `Rueter` actually applies well today: `systemPrompt`, `temperature`, and `maxTokens`.

## How Model Creation Should Work

### Interactive flow

1. Ask for scope: local or global.
2. Ask for model definition name.
3. Ask for provider.
4. Show catalog entries for that provider from `src/const/Models.ts`.
5. Let the user choose a model by human-readable name.
6. Ask for the env var that contains the API key.
7. Offer advanced config fields relevant to that provider.
8. Validate the config.
9. Save the JSON definition.
10. Optionally run a test prompt.

### Non-interactive flow

All of the above should also be possible via flags so the CLI is scriptable.

### Implementation detail

When the command runs:

1. Load the saved model definition.
2. Resolve the API key from `process.env[apiKeyEnv]`.
3. Resolve `modelName` to the current index.
4. Instantiate:

```ts
new RueterModel(provider, apiKey, resolvedIndex, config)
```

5. Run `.prompt(...)`.
6. Render either plain text or JSON.

## How Orchestrator Creation Should Work

### Interactive flow

1. Ask for scope: local or global.
2. Ask for orchestrator name.
3. Let the user multi-select from saved model definitions.
4. Ask for shared overrides:
   - system prompt
   - temperature
   - max tokens
5. Ask for default output preferences.
6. Save the orchestrator definition.

### Runtime flow

When the orchestrator is executed:

1. Load the orchestrator definition.
2. Load each referenced saved model definition.
3. Resolve each API key from the environment.
4. Instantiate a real `RueterModel` per saved definition with its full per-model config.
5. Create:

```ts
new Rueter(instantiatedModels, sharedConfig)
```

6. Run `.prompt(prompt)`.
7. Render one result card per model ID.

### Important implementation rule

Do **not** build orchestrators by calling `rueter.addModel()` if you need full per-model settings, because `addModel()` cannot apply the advanced config fields supported by `RueterModel`.

## Output and UX Plan

The CLI should feel clean and high-signal, not noisy.

### Human-readable output

Use:

- a compact header with target model or orchestrator name
- dim metadata rows for provider, model, duration, and cost
- distinct sections for response text and errors
- subtle color, not rainbow UI
- consistent spacing and width handling

For orchestrators, render:

- one header row for the prompt target
- one result panel per model
- cost summary per model
- a total cost footer when available

### JSON output

Support `--json` everywhere.

Suggested rules:

- single-model commands return the raw `rueter-ai` result shape plus CLI metadata
- orchestrator commands return the raw `RueterResults` plus CLI metadata
- errors should still return structured JSON

### TTY vs non-TTY behavior

- If `stdout` is a TTY, use rich formatting.
- If not, default to plain output unless `--json` is set.
- Add `--no-color` support.

## Presets and Workflow Strategy

After the core saved-model and orchestrator experience is working, add wrappers for the package's existing preset models and workflows.

### Preset models

The CLI should expose preset factories from `src/models/SpecialModels.ts`, for example:

- `simple-answer`
- `prompt-enhancer`
- `terminal-command`
- `keyword-extractor`
- `code-review`
- `documentation`

Implementation approach:

1. Map CLI preset names to exported factory functions.
2. Resolve the required API key.
3. Instantiate the preset `RueterModel`.
4. Run `.prompt()` exactly like any other single model.

### Workflow wrappers

The CLI should later wrap the exported workflow functions from `src/pipelines/Workflows.ts`.

Implementation approach:

1. Parse workflow-specific flags into the appropriate config object.
2. Pass an `onProgress` callback that renders live progress lines.
3. Surface output files clearly at the end.

Note: current workflows appear to assume xAI/Grok-backed special models, so the CLI should document that limitation honestly.

## Proposed CLI Source Layout

```text
src/
  cli/
    index.ts
    types.ts
    commands/
      ask.ts
      config.ts
      doctor.ts
      providers.ts
      models.ts
      orchestrators.ts
      presets.ts
      workflows.ts
    core/
      catalog.ts
      config.ts
      env.ts
      model-definition.ts
      orchestrator-definition.ts
      instantiate-model.ts
      instantiate-orchestrator.ts
      history.ts
      errors.ts
    ui/
      theme.ts
      render-text.ts
      render-json.ts
      render-orchestrator.ts
      prompts.ts
      spinner.ts
```

## Package and Build Changes Needed Later

When we actually implement the CLI, the likely package-level work will be:

1. Add a CLI entrypoint under `src/cli/`.
2. Add a `bin` field in `package.json`, probably pointing to `dist/cli/index.js`.
3. Ensure the TypeScript build emits the CLI files into `dist/`.
4. Keep the main library exports untouched unless we decide to expose more internals publicly.

## Validation Rules the CLI Should Enforce

The CLI should validate more aggressively than the current library does.

### General validation

- Saved names must be filesystem-safe.
- Referenced env vars must exist before execution.
- Provider must be valid.
- Chosen model must exist in the provider catalog.

### Provider-specific config validation

The CLI should only expose or allow config fields that the chosen provider builder supports.

Examples:

- `anthropic`: allow `topP`, `topK`, `stopSequences`
- `openai`: allow `topP`, `frequencyPenalty`, `presencePenalty`, `stopSequences`, `n`
- `gemini`: allow `topP`, `topK`, `stopSequences`, `n`
- `grok`: allow `topP`, `frequencyPenalty`, `presencePenalty`, `stopSequences`, `n`

This validation belongs in the CLI because it gives the user better feedback before requests fail.

## Testing Plan

When implementation begins, add tests for:

1. Config resolution between local and global scopes.
2. Model catalog lookup by provider and model name.
3. Saved model instantiation from JSON definitions.
4. Orchestrator instantiation from multiple saved models.
5. Pretty output rendering.
6. JSON output rendering.
7. Error behavior when API keys are missing.
8. Exit codes for success vs partial failure vs full failure.

Keep the first CLI test layer lightweight. A good starting point is Node's built-in test runner against built JS output.

## Recommended Build Order

### Phase 0: Prep

1. Align on TypeScript for the CLI.
2. Decide the config storage strategy and file schemas.
3. Decide the final command naming.

### Phase 1: Foundation

1. Create CLI entrypoint and command parser.
2. Implement shared config loading and file persistence.
3. Implement provider/model catalog utilities.
4. Implement base terminal theme and output helpers.
5. Add `rueter doctor`, `rueter config init`, and `rueter models catalog`.

### Phase 2: Saved models

1. Implement model definition schema and validation.
2. Implement `models create`, `list`, `show`, `delete`.
3. Implement `models run` and `models test`.
4. Implement `ask` for one-off single-model execution.

### Phase 3: Orchestrators

1. Implement orchestrator definition schema and validation.
2. Implement `orchestrators create`, `list`, `show`, `delete`.
3. Implement `orchestrators run`.
4. Add pretty multi-model result rendering and JSON mode.

### Phase 4: Interactive UX

1. Add `models chat` and `orchestrators chat`.
2. Add history/session persistence.
3. Improve TTY polish and progress rendering.

### Phase 5: Package-native extras

1. Add preset-model wrappers.
2. Add workflow wrappers.
3. Add shell completions and docs.

## Suggested Non-Goals for V1

To keep the first implementation focused, do not try to do these immediately:

- full-screen React TUI
- token streaming
- cloud sync
- embedded secret manager
- generated code files for saved models/orchestrators

## Final Recommendation

When we build this later, we should implement the CLI in **TypeScript**, inside this same package, as a configuration-driven terminal app that creates and runs saved `RueterModel` and `Rueter` definitions.

That gives us the cleanest path to:

- a polished terminal UX
- strong type safety
- easy reuse of the current package internals
- honest alignment with how `RueterModel` and `Rueter` actually work today
