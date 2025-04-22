import { buildEhrStartResourceDiffHandler } from "@metriport/core/external/ehr/resource-diff/steps/start/ehr-start-resource-diff-factory";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { createPatientJob } from "../../../../../command/job/patient/create";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { canvasMetriportOnlyBundleJobType } from "../../shared";

export type StartMetriportOnlyBundleJobParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  requestId?: string | undefined;
};

/**
 * Starts the metriport only bundle job asynchronously for the patient to produce
 * the bundle of resources in Metriport that are not in Canvas.
 *
 * @param cxId - The cxId of the patient.
 * @param canvasPracticeId - The canvas practice id of the patient.
 * @param canvasPatientId - The canvas patient id of the patient.
 * @param requestId - The request id of the job. (optional)
 * @returns the request id of the job.
 * @throws 400 if the job is currently processing.
 */
export async function startMetriportOnlyBundleJob({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  requestId: requestIdParam,
}: StartMetriportOnlyBundleJobParams): Promise<string> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  const metriportPatientId = metriportPatient.id;
  const job = await createPatientJob({
    cxId,
    patientId: metriportPatientId,
    jobType: canvasMetriportOnlyBundleJobType,
    jobGroupId: canvasPatientId,
    requestId: requestIdParam ?? uuidv7(),
    limitedToOneRunningJob: true,
  });
  const jobId = job.id;
  const ehrResourceDiffHandler = buildEhrStartResourceDiffHandler();
  ehrResourceDiffHandler
    .startResourceDiff({
      ehr: EhrSources.canvas,
      cxId,
      practiceId: canvasPracticeId,
      metriportPatientId,
      ehrPatientId: canvasPatientId,
      jobId,
    })
    .catch(processAsyncError(`startCanvasResourceDiff`));
  return jobId;
}
