import { ExtractionFeature, ExtractionFeatureType, ExtractionFeaturePrompt } from "./types";

export const extractionFeaturePrompt: Record<ExtractionFeatureType, ExtractionFeaturePrompt> = {
  condition: {
    toolName: "extractConditions",
    toolPrompt: `The "extractConditions" tool extracts conditions with ICD-10-CM codes`,
  },
  procedure: {
    toolName: "extractProcedures",
    toolPrompt: `The "extractProcedures" tool extracts procedures with SNOMED CT codes`,
  },
  medication: {
    toolName: "extractMedications",
    toolPrompt: `The "extractMedications" tool extracts medication information using RxNorm codes`,
  },
};

export function buildPrompt(text: string, features: ExtractionFeature[]) {
  return [
    buildPromptInstructions(),
    buildPromptTools(features),
    `Here is the clinical text to analyze:\n\n"${text}"`,
  ];
}

function buildPromptInstructions() {
  return `You are an agent that passes a related section of medical information from the given text to an extraction tool for
    further processing. You should call each tools with a substrings of the provided clinical text. You can call more than one
    tool at a time. You should only pass relevant text to the tools WITHOUT MODIFICATION. Do not make any chances, perform any
    type of inference, make any transformations or modifications to the original text, or attempt to look up any medical coding.
    Your only goal is to extract the relevant information that each tool should use.`;
}

function buildPromptTools(features: ExtractionFeature[]) {
  const tools = features.map(feature => extractionFeaturePrompt[feature.type]);
  return `The tools are: ${tools.map(tool => `- ${tool.toolName}: ${tool.toolPrompt}`).join("\n")}`;
}
