import { PatientJobWithData } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import {
  createJobDataPayload,
  getLatestPatientJobByStatus,
} from "../../../../../command/job/patient/get";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { canvasMetriportOnlyBundleJobType } from "../../shared";
import { FetchCanvasBundleResult } from "../../command/bundle/fetch-bundle";
import { fetchCanvasMetriportOnlyBundle } from "../../command/bundle/fetch-metriport-only-bundle";
import { GetMetriportOnlyBundleParams } from "./get-job-payload";

export type GetLatestMetriportOnlyBundleParams = Omit<GetMetriportOnlyBundleParams, "jobId">;

/**
 * Get the latest metriport only bundle job data payload for a Canvas patient
 *
 * @param cxId The CX ID of the patient
 * @param canvasPracticeId The Canvas practice ID
 * @param canvasPatientId The Canvas patient ID
 * @returns metriport only job data payload if completed or undefined if no job is found
 */
export async function getLatestMetriportOnlyBundleJobPayload({
  cxId,
  canvasPracticeId,
  canvasPatientId,
}: GetLatestMetriportOnlyBundleParams): Promise<
  PatientJobWithData<FetchCanvasBundleResult> | undefined
> {
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
  const job = await getLatestPatientJobByStatus({
    cxId,
    patientId: metriportPatientId,
    jobTypeId: canvasMetriportOnlyBundleJobType,
    jobGroupId: canvasPatientId,
  });
  if (!job) return undefined;
  if (job.status === "completed") {
    const data = await fetchCanvasMetriportOnlyBundle({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      jobId: job.id,
    });
    return createJobDataPayload({ job, data });
  }
  return createJobDataPayload({ job });
}
