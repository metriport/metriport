import { Binary, Bundle, Resource } from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";
import { getPatientFromBundle } from "../../external/fhir/patient/shared";
import { isBinary } from "../../external/fhir/shared";
import { capture, out } from "../../util";
import { base64ToString, stringToBase64 } from "../../util/base64";
import { uuidv7 } from "../../util/uuid-v7";

const AI_BRIEF_SOURCE = "metriport:ai-generated-brief";

export const AI_BRIEF_PROVIDERS = ["bedrock", "baseten"] as const;
export type AiBriefProvider = (typeof AI_BRIEF_PROVIDERS)[number];

export const AI_BRIEF_MODELS = ["claude-sonnet-3.5", "openai.gpt-oss-120b-1:0"] as const;
export type AiBriefModel = (typeof AI_BRIEF_MODELS)[number];

// For existing AI summaries (v1)
export const AI_BRIEF_V1_MODEL: AiBriefModel = "claude-sonnet-3.5";

// https://aws.amazon.com/bedrock/pricing/ for Claude 3.7 / 3.5 Sonnet models
export const SONNET_COST_PER_THOUSAND_INPUT_TOKENS = 0.003;
export const SONNET_COST_PER_THOUSAND_OUTPUT_TOKENS = 0.015;
export const GPT_OSS_COST_PER_THOUSAND_INPUT_TOKENS = 0.00015;
export const GPT_OSS_COST_PER_THOUSAND_OUTPUT_TOKENS = 0.0006;

export const AI_BRIEF_V2_MODEL = "openai.gpt-oss-120b-1:0";
export const AI_BRIEF_V2_ENCODING_MODEL_NAME = "gpt-4";

// TODO: remove this once we are certain of the GPT-OSS 120B model provider
export const AI_BRIEF_V2_PROVIDER: AiBriefProvider = "bedrock";
export const DEFAULT_AI_BRIEF_PROVIDER: AiBriefProvider = "bedrock";

export type AiBriefControls = {
  cancelled: boolean;
  provider?: AiBriefProvider;
  model?: AiBriefModel;

  // Temporary: for passing data up from summary generation without modifying the return parameters
  inputTokensUsed?: number;
  outputTokensUsed?: number;
};

export function isAiBriefProvider(provider: string): provider is AiBriefProvider {
  return AI_BRIEF_PROVIDERS.includes(provider as AiBriefProvider);
}

export function isAiBriefModel(model: string): model is AiBriefModel {
  return AI_BRIEF_MODELS.includes(model as AiBriefModel);
}

export function generateAiBriefFhirResource(content: string): Binary {
  const encodedContent = stringToBase64(content);

  return {
    resourceType: "Binary",
    id: uuidv7(),
    meta: {
      versionId: "1",
      lastUpdated: buildDayjs().toISOString(),
      source: AI_BRIEF_SOURCE,
    },
    contentType: "text/plain",
    data: encodedContent,
  };
}

export function getAiBriefContentFromBundle(bundle: Bundle): string | undefined {
  const aiBriefResource = getAiBriefResource(bundle);
  if (!aiBriefResource?.data) return undefined;
  return base64ToString(aiBriefResource.data);
}

function getAiBriefResource(bundle: Bundle): Binary | undefined {
  const { log } = out("getAiBriefContentFromBundle");
  const aiBriefResources =
    bundle.entry?.flatMap(entry => (isAiBriefResource(entry.resource) ? entry.resource : [])) ?? [];
  if (aiBriefResources.length > 1) {
    const msg = `Found more than one AI brief resource in the consolidated bundle`;
    const patient = getPatientFromBundle(bundle, false);
    log(`${msg} - ${aiBriefResources.length} AI Briefs, patient: ${patient?.id}`);
    capture.message(msg, { extra: { aiBriefResources, patient } });
  }
  return aiBriefResources[0];
}

function isAiBriefResource(resource: Resource | undefined): resource is Binary {
  return isBinary(resource) && resource.meta?.source === AI_BRIEF_SOURCE;
}

export function calculateCostsBasedOnTokens(
  totalTokens: { input: number; output: number },
  model: AiBriefModel
): {
  input: number;
  output: number;
  total: number;
} {
  const input = (totalTokens.input * getCostPerThousandInputTokens(model)) / 1000;
  const output = (totalTokens.output * getCostPerThousandOutputTokens(model)) / 1000;
  const total = input + output;

  return { input, output, total };
}

export function getCostPerThousandInputTokens(model: AiBriefModel): number {
  if (model === AI_BRIEF_V2_MODEL) {
    return GPT_OSS_COST_PER_THOUSAND_INPUT_TOKENS;
  }
  return SONNET_COST_PER_THOUSAND_INPUT_TOKENS;
}

export function getCostPerThousandOutputTokens(model: AiBriefModel): number {
  if (model === AI_BRIEF_V2_MODEL) {
    return GPT_OSS_COST_PER_THOUSAND_OUTPUT_TOKENS;
  }
  return SONNET_COST_PER_THOUSAND_OUTPUT_TOKENS;
}
