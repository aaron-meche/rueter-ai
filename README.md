# Rueter

**One unified interface to rule all AI models.**

A lightweight, zero-dependency TypeScript library that provides a single, clean API to interact with **Anthropic, OpenAI, Google Gemini, and xAI Grok**.

Stop switching between different SDKs and response formats. Rueter handles API differences, response shapes, and pricing automatically — while giving you powerful built-in cost tracking and specialized expert models.

---

## ✨ Features

- **Unified `.prompt()` API** across all providers
- **Automatic cost calculation** in USD with real pricing
- **Zero dependencies** — uses native `fetch`
- **Multi-model orchestration** — run prompts across multiple models in parallel
- **10+ Specialized Models** — Compressor, Simple Answer, Prompt Enhancer, Fact Checker, etc.
- **Full TypeScript support** with excellent types
- **Lightweight & fast**

---

## 📦 Installation

```bash
npm install rueter-ai
```

## Quick Start
```js
import { Rueter, RueterModel, SimpleAnswerModel } from 'rueter-ai';
import 'dotenv/config';

const rueter = new Rueter({
  models: [
    new RueterModel("grok", process.env.GROK_API!),
    new RueterModel("anthropic", process.env.ANTHROPIC_API!),
  ],
  temperature: 0,
  maxTokens: 512,
});

const result = await rueter.prompt("What is the capital of Japan?");
console.log(result);
```

## Available Models
**Core Models**
Rueter — Main orchestrator for multiple models
RueterModel — Single model wrapper with cost tracking
