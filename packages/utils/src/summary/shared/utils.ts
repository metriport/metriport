import axios from "axios";
import { Bundle } from "@medplum/fhirtypes";
import { getEnvVarOrFail } from "@metriport/shared";
import {
  isAiBriefProvider,
  isAiBriefModel,
  AiBriefProvider,
  AI_BRIEF_PROVIDERS,
  AI_BRIEF_MODELS,
  AiBriefModel,
} from "@metriport/core/command/ai-brief/shared";

const apiUrl = getEnvVarOrFail("API_URL");
const DEFAULT_SAMPLE_SIZE = 100;

export async function getPatientIds(cxId: string): Promise<string[]> {
  const response = await axios.get(`${apiUrl}/internal/patient/ids?cxId=${cxId}`);
  return response.data.patientIds;
}

export async function samplePatientIds(
  cxId: string,
  sampleSize?: string | number
): Promise<string[]> {
  const allPatientIds = await getPatientIds(cxId);
  return randomChoice(allPatientIds, parseSampleSize(sampleSize));
}

// Fisher-Yates shuffle
export function randomChoice<T>(array: T[], count: number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export function displayInColumns(left: string, right: string, columnWidth = 80) {
  const leftWords = left.split(" ");
  const rightWords = right.split(" ");

  console.log("- CURRENT ".padEnd(columnWidth, "-") + "-|- NEW -".padEnd(columnWidth, "-"));
  while (leftWords.length > 0 || rightWords.length > 0) {
    let leftLine = "";
    let rightLine = "";

    while (leftWords.length > 0 && leftLine.length + leftWords[0].length <= columnWidth) {
      leftLine += leftWords.shift() + " ";
    }
    while (rightWords.length > 0 && rightLine.length + rightWords[0].length <= columnWidth) {
      rightLine += rightWords.shift() + " ";
    }
    console.log(leftLine.trim().padEnd(columnWidth) + " | " + rightLine.trim().padEnd(columnWidth));
  }
}

export function getConsolidatedBundleSize(bundle: Bundle): number {
  return bundle.entry?.length ?? 0;
}

export function parseSampleSize(sampleSize?: string | number): number {
  if (sampleSize == null) return DEFAULT_SAMPLE_SIZE;
  if (typeof sampleSize === "number") return sampleSize;
  const value = parseInt(sampleSize);
  if (!Number.isFinite(value)) throw new Error("Invalid sample size");
  return value;
}

export function parseProviderList(providerList?: string): AiBriefProvider[] {
  // Run on all providers by default
  if (providerList == null) return [...AI_BRIEF_PROVIDERS];
  const providers = providerList.split(",").filter(isAiBriefProvider);
  if (providers.length === 0) {
    throw new Error(`Specify at least one valid provider: ${AI_BRIEF_PROVIDERS.join(", ")}`);
  }
  return providers;
}

export function parseModelList(modelList?: string): readonly AiBriefModel[] {
  if (modelList == null) return [...AI_BRIEF_MODELS];
  const models = modelList.split(",").filter(isAiBriefModel);
  if (models.length === 0) {
    throw new Error(`Specify at least one valid model: ${AI_BRIEF_MODELS.join(", ")}`);
  }
  return models;
}
