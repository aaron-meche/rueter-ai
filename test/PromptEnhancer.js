//
// Prompt Enhancer
//
// Rueter AI
// created by Aaron Meche
//

import { PromptEnhancerPreset, RueterModel } from "rueter-ai"
import "dotenv/config"

const model = new RueterModel("grok", process.env.GROK_API, PromptEnhancerPreset)
try {
    const prompt = `Take a look at this file, and improve all of these "Special Models" to perform their specific function to the best of the ability possible, modfy the system prompts, temperature, and max tokens (if needed), and add the new optional fields just defined in types.ts for the builder config to get the most granual adjustments possible with the intention of polishing these models to perform their functions to the best of their ability.`
    const res = await model.prompt(prompt)
    console.log(res)
}
catch (err) { console.error(err) }
