//
// Rueter AI
//
// created by Aaron Meche
//

import fs from "fs/promises"
import { APIKey } from "./env.js"
import { models } from "./models.js"

//
// HTTPRequest
//
// Default HTTP Request Method
//

// async function getLastCostLine(callback) {
//     try {
//         const data = await fs.readFile('cost.txt', 'utf8');
//         const lines = data.trim().split('\n').filter(line => line.trim() !== '');
//         const lastCost = lines[lines.length - 1]?.split("rolling: ")[1] || 0
//         callback(lastCost)
//     } catch (err) {
//         console.error("Error while reading cost.txt", err.message)
//         return 0
//     }
// }

// async function logCost(costData) {
//     try {
//         getLastCostLine(async (res) => {
//             let inCost = String(costData.input.toFixed(12)).padEnd(16)
//             let outCost = String(costData.output.toFixed(12)).padEnd(16)
//             let totCost = String(costData.total.toFixed(12)).padEnd(16)
//             let rollingCost = String(Number(costData.total.toFixed(12)) + (Number(res).toFixed(12))).padEnd(16)
//             const line = `in: ${inCost}out: ${outCost}total: ${totCost}rolling: ${rollingCost}\n`
//             await fs.appendFile('cost.txt', line, 'utf8');
//         })
//     } catch (err) {
//         console.error('Error while writing cost.txt:', err.message);
//     }
// }

function calculateUsageCost(res, model) {
    let inputTok =  res?.usage?.prompt_tokens || res?.usage?.input_tokens || 
                    res?.usage_metadata?.prompt_token_count || 
                    res?.usage?.input_tokens || 0;

    let outputTok = res?.usage?.completion_tokens || res?.usage?.output_tokens || 
                    res?.usage_metadata?.candidates_token_count || 
                    res?.usage_metadata?.output_token_count || 
                    res?.usage?.output_tokens || 0;
    let inputCost = model.input_cost
    let outputCost = model.output_cost
    let inputPrice = (inputTok * inputCost) / 1_000_000
    let outputPrice = (outputTok * outputCost) / 1_000_000
    let totalPrice = inputPrice + outputPrice
    return {
        model: model.name,
        input: inputPrice.toFixed(8),
        output: outputPrice.toFixed(8),
        total: totalPrice.toFixed(8)
    }
}

export class AIModel {
    // AI Model Specific Values
    #provider = null
    #model = null
    #apiKey = null
    // Tinkering Values
    #systemPrompt = ""
    #temperature = 0.7
    #maxTokens = 1024
    // Company-Specific HTTP Request Formatting
    #builders = {
        "anthropic": (prompt) => ({
            url: "https://api.anthropic.com/v1/messages",
            method: "POST",
            headers: {
                "x-api-key": this.#apiKey,
                "anthropic-version": "2023-06-01"
            },
            body: {
                model: this.#model?.name,
                max_tokens: this.#maxTokens,
                temperature: this.#temperature,
                system: this.#systemPrompt,
                messages: [
                    { role: "user", content: prompt }
                ]
            }
        }),
        "grok": (prompt) => {
            return {
                url: "https://api.x.ai/v1/chat/completions",
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.#apiKey}`
                },
                body: {
                    model: this.#model?.name,
                    messages: [
                        { role: "system", content: this.#systemPrompt },
                        { role: "user",   content: prompt }
                    ],
                    temperature: this.#temperature,
                    max_tokens: this.#maxTokens
                }
            }
        },
        "openai": (prompt) => ({
            url: "https://api.openai.com/v1/chat/completions",
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.#apiKey}`
            },
            body: {
                model: this.#model?.name,
                messages: [
                    { role: "system", content: this.#systemPrompt },
                    { role: "user",   content: prompt }
                ],
                temperature: this.#temperature,
                max_tokens: this.#maxTokens
            }
        }),
        "gemini": (prompt) => ({
            url: `https://generativelanguage.googleapis.com/v1beta/models/${this.#model.name}:generateContent?key=${this.#apiKey}`,
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: this.#temperature,
                    maxOutputTokens: this.#maxTokens
                },
                systemInstruction: this.#systemPrompt ? { parts: [{ text: this.#systemPrompt }] }  : undefined
            }
        })
    }

    constructor(provider, apiKey, model = 0) {
        this.#provider = provider || null
        this.#apiKey = apiKey || null
        this.#model = models[provider][model] || null
    }

    async #httpRequest(builder) {
        const options = {
            method: builder.method,
            headers: {
                "Content-Type": "application/json",
                ...builder.headers
            },
            body: JSON.stringify(builder.body)
        }
        const response = await fetch(builder.url, options)

        if (!response.ok) {
            console.error(`[${this.#provider}] HTTP ${response.status} - ${response.statusText}`)
        } else {
            return await response.json()
        }
    }

    async prompt(prompt, callback) {
        const builder = this.#builders[this.#provider](prompt)
        const res = await this.#httpRequest(builder)
        const responseText = 
            res.choices?.[0]?.message?.content ||             // Grok + OpenAI
            res.content?.[0]?.text ||                         // Anthropic (Claude)
            res.candidates?.[0]?.content?.parts?.[0]?.text || // Gemini
            res.output_text ||                                // Fallback
            JSON.stringify(res);                              // If all else fails
        let costCalc = calculateUsageCost(res, this.#model)
        return { response: responseText, cost: costCalc };
        // await logCost(costCalc);
    }

    setSystemPrompt(sysPrompt) {
        if (typeof sysPrompt !== "string" || sysPrompt.trim().length == 0) return
        this.#systemPrompt = sysPrompt.trim()
    }

    setTemperature(temp) {
        if (!Number.isFinite(temp) || temp < 0 || temp > 1) return
        this.#temperature = temp
    }

    setMaxTokens(maxTok) {
        if (!Number.isInteger(maxTok) || maxTok <= 0 || maxTok > 100_000) return
        this.#maxTokens = maxTok
    }

    getID() {
        return this.#provider + "_" + this.#model.name
    }
}

export class AIOrchestra {
    #models = []

    constructor(config) {
        if (config.models) this.#models = config.models || []
        if (config.systemPrompt) this.setSystemPrompt(config.systemPrompt)
        if (config.temperature) this.setTemperature(config.temperature)
        if (config.maxTokens) this.setMaxTokens(config.maxTokens)
    }
    
    addModel(provider, apiKey, model = 0) {
        this.#models.push(new AIModel(provider, apiKey, model))
    }

    async prompt(prompt, callback) {
        const results = {};
        // Call each prompt together
        const promises = this.#models.map(async (model) => {
            const id = model.getID()
            try {
                const { response, cost } = await model.prompt(prompt)
                return { id, response, cost: cost.total }
            } catch (error) {
                console.error(`Error with model ${id}:`, error.message)
                return { id, response: null, cost: 0, error: error.message }
            }
        })
        // Await completion of all
        const completed = await Promise.all(promises);
        // Update results object
        completed.forEach(({ id, response, cost, error }) => {
            results[id] = { res: response, cost, ...(error && { error }) }
        })
        return results;
    }

    setSystemPrompt(sysPrompt) {
        this.#models.forEach(model => {
            model.setSystemPrompt(sysPrompt)
        })
    }

    setTemperature(temp) {
        this.#models.forEach(model => {
            model.setTemperature(temp)
        })
    }

    setMaxTokens(maxTok) {
        this.#models.forEach(model => {
            model.setMaxTokens(maxTok)
        })
    }
}

const exprompts = {
    files_in_directory: "What terminal command would you use to get the full list of files and folders in the current directory?",
    list_hidden_files: "What command lists all files including hidden ones in the current directory?",
    current_directory: "What terminal command prints the current working directory?",
    safe_recursive_delete: "What command safely deletes the directory 'old_project' and everything inside it (with confirmation prompt)?",
    advanced_find_js: "What command recursively finds every .js and .ts file in the current folder and subfolders that contains the word 'TODO' and shows the matching line numbers?",
    kill_port_safely: "What command kills any process listening on port 3000 (gracefully, cross-platform compatible)?",
    modern_package_update: "What single command updates all npm packages in the current project to their latest versions safely?",
    git_clean_untracked: "What git command removes all untracked files and directories (including ignored ones) but asks for confirmation first?",
    large_file_search: "What command finds the 10 largest files in the current directory tree (human-readable sizes)?",
    sed_replace_safe: "What command safely replaces every occurrence of 'oldString' with 'newString' in all .md files recursively (with backup)?",
    docker_prune_safe: "What command removes all unused Docker images, containers, volumes, and networks at once?",
    count_lines_code: "What command counts the total number of lines of code in the current project (excluding node_modules and .git)?",
    ps_aux_filtered: "What command shows only the processes that contain 'node' in the name, sorted by CPU usage?",
    tar_compress_smart: "What command creates a compressed .tar.gz archive of the folder 'src' while excluding all node_modules folders?",
    curl_with_retry: "What curl command downloads a file from https://example.com/file.zip with 3 retries and a 10-second timeout?"
};

const sysprompts = {
    terminal: "Respond with ONLY the exact terminal command. No explanation, no markdown, no code blocks, no backticks, no extra text. Just the raw command.",
    terminal_strict: "Output nothing but the raw terminal command. No formatting, no quotes, no explanations, no code blocks. Single line only.",
    terminal_minimal: "Reply with only the command.",
    claude_code: "You are Claude Code. Respond with ONLY the raw terminal command. Never use backticks, code blocks, markdown, or any formatting. Never wrap the command. Output must be plaintext only and directly copy-pasteable.",
    claude_code_strict: "Act as Claude Code. Output ONLY the raw terminal command — nothing else. Prioritize safety, precision, and modern best practices (e.g. quoting, confirmation flags, avoiding dangerous defaults).",
    claude_code_safe: "You are Claude Code. Give me the single best, safest terminal command possible. Respond with exactly one line containing only the command — no explanations, no markdown, no formatting.",
    claude_code_agent: "You are Claude Code inside a VS Code terminal agent. Always return the single most reliable and safe command. Output must be plaintext only.",
    none: ""   // for testing raw model behavior
};
async function main() {
    const prompt = exprompts.count_lines_code
    let orchestra = new AIOrchestra({
        models: [
            new AIModel("anthropic", APIKey.anthropic),
            new AIModel("grok", APIKey.grok, 1),
        ],
        systemPrompt: sysprompts.claude_code,
        maxTokens: 80,
    })
    try {
        const results = await orchestra.prompt(prompt);
        console.log(results);
    } catch (err) {
        console.error("Orchestra prompt failed:", err);
    }
}
main()  