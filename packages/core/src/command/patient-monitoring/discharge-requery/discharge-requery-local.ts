import { BadRequestError, errorToString, NotFoundError, sleep } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { capture } from "../../../util";
import { out } from "../../../util/log";
import { updateJobRuntimeData } from "../../job/patient/api/update-job-runtime-data";
import { startDocumentQuery } from "../../shared/api/start-document-query";
import { startPatientQuery } from "../../shared/api/start-patient-query";
import {
  DischargeRequery,
  dischargeRequeryContext,
  ProcessDischargeRequeryRequest,
} from "./discharge-requery";

const defaultTriggerConsolidated = false;
const defaultDisableWebhooks = true;
const defaultRerunPdOnNewDemographics = true;

export class DischargeRequeryLocal implements DischargeRequery {
  constructor(private readonly waitTimeInMillis: number = 0) {}

  async processDischargeRequery({ cxId, jobId, patientId }: ProcessDischargeRequeryRequest) {
    const { log } = out(
      `${dischargeRequeryContext}.local - cx ${cxId}, job ${jobId}, pt ${patientId}`
    );

    try {
      let dataPipelineRequestId = uuidv7();
      await startPatientQuery({
        cxId,
        patientId,
        dataPipelineRequestId,
        rerunPdOnNewDemographics: defaultRerunPdOnNewDemographics,
        context: dischargeRequeryContext,
      });

      if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);

      try {
        const { requestId: dqRequestId } = await startDocumentQuery({
          cxId,
          requestId: dataPipelineRequestId,
          patientId,
          triggerConsolidated: defaultTriggerConsolidated,
          disableWebhooks: defaultDisableWebhooks,
          context: dischargeRequeryContext,
        });
        if (dataPipelineRequestId !== dqRequestId) {
          log(`DQ already running, using existing requestId: ${dqRequestId}`);
          dataPipelineRequestId = dqRequestId;
        }
      } catch (error) {
        const errorMsg = errorToString(error);
        const msg = `Failed to process discharge requery`;
        log(`${msg} - cause: ${errorMsg}`);

        if (error instanceof BadRequestError || error instanceof NotFoundError) {
          return;
        }

        capture.setExtra({
          cxId,
          jobId,
          patientId,
          context: `${dischargeRequeryContext}.processDischargeRequery`,
          error,
        });
        throw error;
      }

      await updateJobRuntimeData({
        jobId,
        cxId,
        runtimeData: {
          documentQueryRequestId: dataPipelineRequestId,
        },
        context: dischargeRequeryContext,
      });
    } catch (error) {
      log(`Error processing discharge requery: ${error}`);
      throw error;
    }
  }
}
