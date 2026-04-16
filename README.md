# Rueter

**One unified interface to rule all AI models.**

A lightweight, high-performance npm package (with zero dependencies) that lets you call **Anthropic, OpenAI, Google Gemini, and xAI Grok** using the same simple syntax — no more juggling different SDKs, response formats, or pricing logic.

---

## ✨ Features

- **Unified API** — Same `.prompt()` method across all providers
- **Smart cost tracking** — Automatic token usage + USD/cents cost calculation per call
- **Lightweight** — Zero heavy dependencies, pure `fetch`
- **Provider-aware** — Handles differences in Anthropic, OpenAI, Gemini, and Grok automatically
- **Cost-aware models** — Pre-configured cheapest-to-most-powerful models with real pricing

Perfect for agents, chatbots, multi-model routing, cost optimization, and production AI workloads.

---

## 📦 Installation

```bash
npm install rueter-ai
```