//
// Prompt Enhancer
//
// Rueter AI
// created by Aaron Meche
//

import { RueterModel } from "rueter-ai"
import "dotenv/config"

const model = new RueterModel("grok", process.env.GROK_API, 1)
const response = await model.prompt("What is the sum of 4 and 5?")
console.log(response)