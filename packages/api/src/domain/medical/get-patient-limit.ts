import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared/common/error";
import { getCxsWithIncreasedSandboxLimitFeatureFlagValue } from "../../external/aws/appConfig";
import { Config } from "../../shared/config";

export async function getSandboxPatientLimitForCx(cxId: string): Promise<number> {
  try {
    const cxIdsWithSandboxPatientVolume = await getCxsWithIncreasedSandboxLimitFeatureFlagValue();
    if (!cxIdsWithSandboxPatientVolume || cxIdsWithSandboxPatientVolume.length <= 0) {
      return Config.SANDBOX_PATIENT_LIMIT;
    }
    const cxIdAndLimit = cxIdsWithSandboxPatientVolume.find(i => i.includes(cxId));
    if (cxIdAndLimit) {
      return parsePatientLimit(cxIdAndLimit);
    }
  } catch (error) {
    const msg = "Failed to get sandbox patient limit";
    console.error(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        context: "getSandboxPatientLimitForCx",
        cxId,
        error,
      },
    });
  }
  return Config.SANDBOX_PATIENT_LIMIT;
}

function parsePatientLimit(patientAndLimit: string): number {
  const limitAsString = patientAndLimit.split(":")[1];
  if (!limitAsString) {
    throw new MetriportError("Missing patient limit", undefined, { patientAndLimit });
  }
  const parsedLimit = parseInt(limitAsString);
  if (isNaN(parsedLimit)) {
    throw new MetriportError("Invalid patient limit", undefined, { limit: limitAsString });
  }
  return parsedLimit;
}
