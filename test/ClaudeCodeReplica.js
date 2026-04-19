//
// claudeCodeLike.js
//
// Rueter AI
// created by Aaron Meche
//

// test/claudeCodePrototype.js
import fs from 'fs';
import 'dotenv/config';
import { PromptEnhancerModel, DecomposerModel, CodeGeneratorModel } from "../dist/index.js";

const promptEnhancer = PromptEnhancerModel(process.env.GROK_API);
const decomposer = DecomposerModel(process.env.GROK_API);
const codeGenerator = CodeGeneratorModel(process.env.GROK_API);

/**
 * Lightweight Claude-Code-like prototype
 * Takes a big vague prompt → enhances it → breaks it down → generates code → writes files
 */
async function claudeCodePrototype(originalPrompt, baseDir = "./generated") {
    console.log("🚀 Starting Claude-Code-like generation...\n");

    let totalCost = 0;

    try {
        // 1. Enhance the original vague prompt
        console.log("🔄 1. Enhancing prompt...");
        const enhancedResult = await promptEnhancer.prompt(originalPrompt);
        const enhancedPrompt = await enhancedResult.res;
        totalCost += Number(await enhancedResult.cost.total);
        console.log("✅ Enhanced Prompt ready\n");

        // 2. Decompose the big task into smaller manageable pieces
        console.log("🔄 2. Decomposing large task into subtasks...");
        const decompositionResult = await decomposer.prompt(enhancedPrompt);
        const decompositionText = await decompositionResult.res;
        totalCost += Number(await decompositionResult.cost.total);

        console.log("✅ Decomposition complete:\n");
        console.log(decompositionText);
        console.log("\n" + "=".repeat(90) + "\n");

        // 3. Create base directory if it doesn't exist
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }

        // 4. Generate code for each subtask
        const subtasks = decompositionText
            .split(/\d+\./)
            .filter(line => line.trim().length > 10)
            .map(task => task.trim());

        console.log(`🤖 3. Generating code for ${subtasks.length} subtasks...\n`);

        for (let i = 0; i < subtasks.length; i++) {
            const task = subtasks[i];
            console.log(`   Generating file ${i + 1}/${subtasks.length}...`);

            const generatedResult = await codeGenerator.prompt(
                `Write clean, production-ready JavaScript code for this specific task:\n\n${task}\n\nOutput ONLY the code, no markdown, no explanations.`
            );

            let code = await generatedResult.res;
            
            // Clean up any leftover markdown
            code = code
                .replace(/```[\w]*\n?/g, '')
                .replace(/```\s*$/g, '')
                .trim();

            const filename = `part${String(i + 1).padStart(2, '0')}.js`;
            const filepath = `${baseDir}/${filename}`;

            fs.writeFileSync(filepath, code, 'utf8');
            console.log(`   ✅ Written → ${filepath}`);
            totalCost += Number(await generatedResult.cost.total);
        }

        console.log("\n🎉 All files generated successfully!");
        console.log(`📁 Output directory: ${baseDir}`);
        console.log(`💰 Total cost: $${totalCost.toFixed(6)}`);

    } catch (err) {
        console.error("❌ Error in claudeCodePrototype:", err);
    }
}

// ─────────────────────────────────────────────
// TEST WITH YOUR RUE LANGUAGE PROMPT
// ─────────────────────────────────────────────

const CodePrompt = `
I am trying to write a new coding language called the "rue" programming language. it is designed as a javascript-compiled language, where 
a javascript file will read a .rue file, take the text content, and run it through a javascript compiler, where it will translate the rue
syntax into functioning css syntax. the only new feature that the rue programming language adds is the ability to have nested styles, such as:
.special-box{
    background: black;
    .inside{
        background: red;
    }
    :hover{
        outline: solid 1pt white;
    }
}
... write a javascript file that contains RueFile class with the necessary utilities to compile a rue language file into functioning, correct css
`;

claudeCodePrototype(CodePrompt, "./generated/rue-project");