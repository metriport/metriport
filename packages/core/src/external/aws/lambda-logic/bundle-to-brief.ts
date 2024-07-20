import { Bundle } from "@medplum/fhirtypes";
import { BedrockUtils } from "../bedrock";

const resourceToFilterOut = ["Location", "Coverage", "Device", "Organization", "Practitioner"];

function getBedrockUtilsInstance(): BedrockUtils {
  return new BedrockUtils();
}

export async function bundleToBrief(fhirBundle: Bundle): Promise<string | undefined> {
  const briefBundle = prepareBundleForBrief(fhirBundle);
  if (!briefBundle) return undefined;

  const bedrockUtils = getBedrockUtilsInstance();
  const prompt =
    "Write a short summary of the patient's well-being that is relevant today. Be specific with the dates for any significant events. Provide the lates vitals if they're abnormal. Focus on any diagnoses that occurred in the past year.";
  const body = JSON.stringify(briefBundle);
  try {
    return await bedrockUtils.getBedrockResponse({
      prompt,
      body,
    });
  } catch (error) {
    return undefined;
  }
}

function prepareBundleForBrief(bundle: Bundle): Bundle | undefined {
  const entries = bundle.entry;
  const filteredEntries = entries?.filter(entry => {
    const resource = entry.resource;
    if (resource && resourceToFilterOut.includes(resource.resourceType)) {
      return false;
    }
    return true;
  });

  if (!filteredEntries) return undefined;

  return {
    ...bundle,
    entry: filteredEntries,
  };
}
