import { getCxsWithIncreasedSandboxLimitFeatureFlagValue } from "../../external/aws/appConfig";
import { Config } from "../../shared/config";
import { capture } from "../../shared/notifications";

export async function getSandboxPatientLimitForCx(cxId: string): Promise<number> {
  const cxIdsWithIncreasedSandboxPatientVolumeEnabled =
    await getCxsWithIncreasedSandboxLimitFeatureFlagValue();
  if (!cxIdsWithIncreasedSandboxPatientVolumeEnabled) return Config.SANDBOX_PATIENT_LIMIT;

  const cxIdAndLimit = cxIdsWithIncreasedSandboxPatientVolumeEnabled.find(i => i.includes(cxId));
  const limit = cxIdAndLimit ? parsePatientLimit(cxIdAndLimit) : undefined;
  return limit ?? Config.SANDBOX_PATIENT_LIMIT;
}

function parsePatientLimit(increasedPatientLimitFeatureFlagValue: string): number | undefined {
  const patientLimit = increasedPatientLimitFeatureFlagValue.split(":")[1];

  if (!patientLimit) {
    const msg = "Failed to parse patient limit from increasedPatientLimitFeatureFlagValue";
    console.error(`${msg} - ${increasedPatientLimitFeatureFlagValue}`);
    capture.error(msg, {
      extra: { increasedPatientLimitFeatureFlagValue, context: "parseCxIdAndLimit" },
    });
  }

  return parseInt(patientLimit);
}
