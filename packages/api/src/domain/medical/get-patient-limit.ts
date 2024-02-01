import { getCxsWithIncreasedSandboxLimitFeatureFlagValue } from "../../external/aws/appConfig";
import { Config } from "../../shared/config";

export async function getPatientLimitForCx(cxId: string): Promise<number> {
  const cxIdsWithIncreasedSandboxPatientVolumeEnabled =
    await getCxsWithIncreasedSandboxLimitFeatureFlagValue();
  const cxIdAndLimit = cxIdsWithIncreasedSandboxPatientVolumeEnabled.find(i => i.includes(cxId));
  const limit = cxIdAndLimit ? parseCxIdAndLimit(cxIdAndLimit)?.patientLimit : undefined;
  return limit ?? Config.SANDBOX_PATIENT_LIMIT;
}

function parseCxIdAndLimit(increasedPatientLimitFeatureFlagValue: string):
  | {
      cxId: string;
      patientLimit: number;
    }
  | undefined {
  const cxIdsAndLimits = increasedPatientLimitFeatureFlagValue.split(":");

  if (cxIdsAndLimits[0] && cxIdsAndLimits[1])
    return { cxId: cxIdsAndLimits[0], patientLimit: parseInt(cxIdsAndLimits[1]) };
  return;
}
