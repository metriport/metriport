import { ExtractionFeature } from "../types";
import { BedrockChatThread } from "./types";
import { extractionFeaturePrompt } from "./tools";

export function buildChatThread(text: string, features: ExtractionFeature[]): BedrockChatThread {
  return [buildPrompt(text, features)];
}

export function buildPrompt(text: string, features: ExtractionFeature[]) {
  return [
    buildPromptInstructions(),
    buildToolPrompt(features),
    `Here is the clinical text to analyze:\n\n"${text}"`,
  ].join("\n");
}

function buildPromptInstructions() {
  return `You are an agent that passes a related section of medical information from the given text to an extraction tool for
    further processing. You should call each tools with a substrings of the provided clinical text. You can call more than one
    tool at a time. You should only pass relevant text to the tools WITHOUT MODIFICATION. Do not make any chances, perform any
    type of inference, make any transformations or modifications to the original text, or attempt to look up any medical coding.
    Your only goal is to extract the relevant information that each tool should use.`;
}

function buildToolPrompt(features: ExtractionFeature[]) {
  const tools = features.map(feature => extractionFeaturePrompt[feature.type]);
  return `The tools are:\n${tools
    .map(tool => `- ${tool.toolName}: ${tool.toolPrompt}`)
    .join("\n")}`;
}
