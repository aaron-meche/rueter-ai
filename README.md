# Rueter

**One unified interface to rule all AI models.**

A lightweight, zero-dependency TypeScript library that lets you interact with **Anthropic, OpenAI, Google Gemini, and xAI Grok** using a single, consistent API.

Stop wrestling with different SDKs, response formats, and pricing logic — Rueter gives you one clean `.prompt()` method across all providers, with built-in cost tracking.

---

## ✨ Features

- **Unified Prompt Interface** — Same `.prompt()` method for all models
- **Automatic Cost Tracking** — Real-time token usage and USD cost calculation per request
- **Zero Dependencies** — Pure `fetch`, extremely lightweight
- **Smart Provider Handling** — Automatically adapts to each provider’s API quirks
- **Specialized Models** — Ready-to-use expert models (Compressor, Fact Checker, Terminal Command, Prompt Enhancer, etc.)
- **Full TypeScript Support** — Excellent types and IDE experience
- **Multi-Model Orchestration** — Easily run the same prompt across multiple models in parallel
- **Cost-Aware** — Built-in pricing for all supported models

---

## 📦 Installation

```bash
npm install rueter-ai