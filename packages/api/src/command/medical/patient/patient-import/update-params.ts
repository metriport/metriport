import { PatientImport } from "@metriport/shared/domain/patient/patient-import/types";
import { getPatientImportJobModelOrFail } from "./get";

export type PatientImportUpdateParamsCmd = {
  cxId: string;
  jobId: string;
  rerunPdOnNewDemographics?: boolean | undefined;
  triggerConsolidated?: boolean | undefined;
  disableWebhooks?: boolean | undefined;
  dryRun?: boolean | undefined;
};

/** ---------------------------------------------------------------------------
 * Updates a bulk patient import job's parameters.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param rerunPdOnNewDemographics - Whether to rerun PD on new demographics.
 * @param triggerConsolidated - Whether to trigger consolidated.
 * @param disableWebhooks - Whether to disable webhooks.
 * @returns the updated job.
 */
export async function updatePatientImportParams({
  cxId,
  jobId,
  rerunPdOnNewDemographics,
  triggerConsolidated,
  disableWebhooks,
  dryRun,
}: PatientImportUpdateParamsCmd): Promise<PatientImport> {
  const job = await getPatientImportJobModelOrFail({ cxId, id: jobId });

  job.paramsOps = {
    ...job.paramsOps,
    ...(rerunPdOnNewDemographics !== undefined && { rerunPdOnNewDemographics }),
    ...(triggerConsolidated !== undefined && { triggerConsolidated }),
    ...(disableWebhooks !== undefined && { disableWebhooks }),
    ...(dryRun !== undefined && { dryRun }),
  };
  job.changed("paramsOps", true);
  const updatedJob = await job.save();
  return updatedJob.dataValues;
}
