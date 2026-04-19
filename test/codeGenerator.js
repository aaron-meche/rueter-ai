//
// codeGenerator
//
// Rueter AI Sandbox
// created by Aaron Meche
//
// Tests the CodeProjectGenerator workflow end-to-end.
// Run: node test/codeGenerator.js
//

import "dotenv/config"
import { CodeProjectGenerator } from "rueter-ai"

const PROJECT_PROMPT = `
Build a "Rue" programming language compiler and toolchain. Rue is a JavaScript-compiled
styling language that compiles .rue files into valid CSS. Its defining feature is support
for nested style blocks, for example:

  .special-box {
      background: black;
      .inside {
          background: red;
      }
      :hover {
          outline: solid 1pt white;
      }
  }

The project must include:
  - A RueFile class that reads a .rue source file and compiles it to CSS
  - A recursive parser that correctly resolves nested selectors into flat CSS rules
  - A CLI entry point (rue.js) that accepts a .rue file path and writes a .css file
  - A small standard library of reusable .rue snippets (reset, typography, colors)
  - A test suite covering nested selectors, pseudo-classes, media queries, and edge cases
`

await CodeProjectGenerator({
    apiKey:       process.env.GROK_API,
    projectPrompt: PROJECT_PROMPT,
    outputDir:    "./rue-lang",
    projectMdPath: "./RueterProject.md",
    onProgress(message) {
        console.log(message)
    },
})
