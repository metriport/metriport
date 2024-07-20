import { Bundle } from "@medplum/fhirtypes";
import { BedrockUtils } from "../bedrock";
import { Config } from "../../..//util/config";

const region = Config.getAWSRegion();

function getBedrockUtilsInstance(): BedrockUtils {
  return new BedrockUtils(region);
}

export async function bundleToBrief(fhirBundle: Bundle): Promise<string | undefined> {
  const bedrockUtils = getBedrockUtilsInstance();
  const prompt =
    "Write a short summary of the patient's well-being that is relevant today. Be specific with the dates for any significant events. Provide the lates vitals if they're abnormal. Focus on any diagnoses that occurred in the past year.";
  const body = JSON.stringify(fhirBundle);
  try {
    return await bedrockUtils.getBedrockResponse({
      prompt,
      body,
    });
  } catch (error) {
    console.log("fuck");
    return undefined;
  }
}
