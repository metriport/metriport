import { buildEhrStartResourceDiffBundlesHandler } from "@metriport/core/external/ehr/bundle/create-resource-diff-bundles/steps/start/ehr-start-resource-diff-bundles-factory";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { BadRequestError } from "../../../../../../../../shared/dist";
import { createPatientJob } from "../../../../../../command/job/patient/create";
import { getPatientMappingOrFail } from "../../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../../command/medical/patient/get-patient";
import { processAsyncError } from "../../../../../../errors";
import { getCreateCanvasResourceDiffBundlesJobType } from "../../../shared";

export type CreateResourceDiffBundlesParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  direction: ResourceDiffDirection;
  requestId?: string;
};

/**
 * Starts the resource diff job to produce the resource type bundles containing
 * the resources in Metriport that are not in Canvas, or vice versa.
 *
 * @param cxId - The cxId of the patient.
 * @param canvasPracticeId - The canvas practice id of the patient.
 * @param canvasPatientId - The canvas patient id of the patient.
 * @param direction - The direction of the resource diff bundles to create.
 * @param requestIdParam - The request id of the job.
 */
export async function createResourceDiffBundlesJob({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  direction,
  requestId,
}: CreateResourceDiffBundlesParams): Promise<string> {
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
    jobType: getCreateCanvasResourceDiffBundlesJobType(direction),
    jobGroupId: canvasPatientId,
    requestId: requestId ?? uuidv7(),
    limitedToOneRunningJob: true,
  });
  const jobId = job.id;
  if (direction === ResourceDiffDirection.METRIPORT_ONLY) {
    const ehrResourceDiffHandler = buildEhrStartResourceDiffBundlesHandler();
    ehrResourceDiffHandler
      .startResourceDiffBundlesMetriportOnly({
        ehr: EhrSources.canvas,
        cxId,
        practiceId: canvasPracticeId,
        metriportPatientId,
        ehrPatientId: canvasPatientId,
        jobId,
      })
      .catch(processAsyncError("Canvas startResourceDiffBundlesMetriportOnly"));
    return jobId;
  }
  throw new BadRequestError("Unsupported direction", undefined, {
    direction,
  });
}
