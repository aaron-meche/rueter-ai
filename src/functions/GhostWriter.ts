//
// Writing Style Replicator
//
// Rueter AI
// created by Aaron Meche
//

import { 
    WritingStyleAnalyzerModel, 
    StyleReplicatorModel 
} from "../models/SpecialModels.js"
import "dotenv/config"

export async function GhostWriter(apiKey: string, history: string[], prompt: string): Promise<string> {
    const styleAnalyzer = WritingStyleAnalyzerModel(apiKey)
    const styleReplicator = StyleReplicatorModel(apiKey)
    const styleGuide = await styleAnalyzer.prompt(history.join("\n---\n"))
    const replicatedOutput = await styleReplicator.prompt(`Style Guide: {{ ${styleGuide} }} ... Assignment: {{ ${prompt} }`)
    console.log(styleGuide)
    console.log("----------")
    console.log(replicatedOutput)
    return replicatedOutput
}