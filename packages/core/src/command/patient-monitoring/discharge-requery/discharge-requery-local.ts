import { errorToString, sleep } from "@metriport/shared";
import { randomIntBetween } from "@metriport/shared/common/numbers";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { updateJobRuntimeData } from "../../job/patient/api/update-job-runtime-data";
import { startDocumentQuery } from "../../shared/api/start-document-query";
import { startPatientQuery } from "../../shared/api/start-patient-query";
import {
  DischargeRequery,
  dischargeRequeryContext,
  ProcessDischargeRequeryRequest,
} from "./discharge-requery";

dayjs.extend(duration);

const defaultTriggerConsolidated = false;
const defaultDisableWebhooks = true;
const defaultRerunPdOnNewDemographics = true;

const waitTimeBetweenPdAndDq = () => dayjs.duration(randomIntBetween(80, 120), "milliseconds");

export class DischargeRequeryLocal implements DischargeRequery {
  async processDischargeRequery({ cxId, jobId, patientId }: ProcessDischargeRequeryRequest) {
    const { log } = out(
      `${dischargeRequeryContext}.local - cx ${cxId}, job ${jobId}, pt ${patientId}`
    );

    try {
      let dataPipelineRequestId = uuidv7();
      const { requestId: pdRequestId } = await startPatientQuery({
        cxId,
        patientId,
        dataPipelineRequestId,
        rerunPdOnNewDemographics: defaultRerunPdOnNewDemographics,
        context: dischargeRequeryContext,
      });
      if (dataPipelineRequestId !== pdRequestId) {
        log(`PD already running, using existing requestId: ${pdRequestId}`);
        dataPipelineRequestId = pdRequestId;
      }

      await updateJobRuntimeData({
        jobId,
        cxId,
        runtimeData: { patientDiscoveryRequestId: dataPipelineRequestId },
        context: dischargeRequeryContext,
      });

      await sleep(waitTimeBetweenPdAndDq().asMilliseconds());
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

      await updateJobRuntimeData({
        jobId,
        cxId,
        runtimeData: {
          patientDiscoveryRequestId: pdRequestId,
          documentQueryRequestId: dataPipelineRequestId,
        },
        context: dischargeRequeryContext,
      });
    } catch (error) {
      const msg =
        `Failure while processing discharge requery @ ${dischargeRequeryContext}` +
        `patient ${patientId}`;
      const errorMsg = errorToString(error);
      log(`${msg}. Cause: ${errorMsg}`);
      capture.setExtra({
        cxId,
        jobId,
        patientId,
        context: `${dischargeRequeryContext}.processDischargeRequery`,
        error,
      });
      throw error;
    }
  }
}
