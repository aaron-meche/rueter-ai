//
// codeGenerator
//
// Rueter AI Sandbox
// created by Aaron Meche
//

import fs from 'fs';
import 'dotenv/config'
import { PromptEnhancerModel, CodeGeneratorModel } from "rueter-ai";

function writeToFile(filePath, textContent) {
    try {
        fs.writeFileSync(filePath, textContent, 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing file:', error.message);
        throw error;
    }
}

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
`


const promptEnhancer = PromptEnhancerModel(process.env.GROK_API)
const codeGenerator = CodeGeneratorModel(process.env.GROK_API)

async function generateCode() {
    let cost = 0;
    try {
        console.log("🔄 Enhancing prompt...\n");
        const enhancedPrompt = await promptEnhancer.prompt(CodePrompt);
        const enhancedPromptText = await enhancedPrompt.res
        const enhancedPromptCost = await enhancedPrompt.cost.total
        console.log("✅ Enhanced Prompt:\n");
        console.log(enhancedPromptText);
        console.log("\n" + "=".repeat(80) + "\n");
        cost += Number(enhancedPromptCost)

        console.log("🤖 Generating code...\n");
        const generatedCode = await codeGenerator.prompt(enhancedPromptText);
        const generatedCodeText = await generatedCode.res
        const generatedCodeCost = await generatedCode.cost.total
        console.log("✅ Generated Code:\n");
        console.log(generatedCodeText);
        cost += Number(generatedCodeCost)

        // Write to file
        const outputPath = "./RueFile.js";
        fs.writeFileSync(outputPath, generatedCodeText, 'utf8');

        console.log(`🎉 Successfully written to: ${outputPath}`);
        console.log("Total Cost", cost)

    } catch (err) {
        console.error("❌ Error during code generation:", err);
    }
}

// Run the generator
generateCode();