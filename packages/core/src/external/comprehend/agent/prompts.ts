const ORCHESTRATOR_ROLE_DEFINITION =
  "Your role is to choose an extraction tool from the provided tools, and use them with substrings of medical text provided by the user.";
const RXNORM_AGENT_ROLE_DEFINITION =
  "Your role is to extract coded FHIR resources from the medical text by passing them to the RxNorm extraction tool.";

const IMPORTANT_EXTRACTOR_INSTRUCTIONS = [
  "Do not produce any output or tell me what you are doing.",
  "I will not run the tool if the substring is not found in the original text.",
  "Try to pass the most concise possible substring of text to the extraction tools, but don't leave out any important details.",
].join("\n");

export const ORCHESTRATOR_PROMPT = `${ORCHESTRATOR_ROLE_DEFINITION}
Do not pass the same text to multiple tools, pick the most relevant tool. The extraction tools are specialized in extracting coded FHIR resources 
from the medical text, and your job is to only pass the relevant text for them to work on.
${IMPORTANT_EXTRACTOR_INSTRUCTIONS}`;

export const RXNORM_AGENT_PROMPT = `${RXNORM_AGENT_ROLE_DEFINITION} ${IMPORTANT_EXTRACTOR_INSTRUCTIONS}`;
