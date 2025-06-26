import { BadRequestError, NotFoundError, sleep } from "@metriport/shared";
import { randomIntBetween } from "@metriport/shared/common/numbers";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { capture } from "../../../util";
import { out } from "../../../util/log";
import { failJob } from "../../job/patient/api/fail-job";
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

function waitTimeBetweenPdAndDq() {
  return dayjs.duration(randomIntBetween(80, 120), "milliseconds");
}

export class DischargeRequeryDirect implements DischargeRequery {
  constructor(private readonly waitTimeInMillis: number = 0) {}

  async processDischargeRequery({
    cxId,
    jobId,
    patientId,
    reportError = true,
  }: ProcessDischargeRequeryRequest) {
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

      await sleep(waitTimeBetweenPdAndDq().asMilliseconds());

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
        if (error instanceof BadRequestError || error instanceof NotFoundError) {
          await failJob({
            jobId,
            cxId,
            reason: JSON.stringify(error.status),
            context: dischargeRequeryContext,
          });
          return;
        }

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
      if (reportError) {
        await failJob({
          jobId,
          cxId,
          reason: "Error processing discharge requery",
          context: dischargeRequeryContext,
        });
      }

      capture.setExtra({
        cxId,
        jobId,
        patientId,
        context: `${dischargeRequeryContext}.processDischargeRequery`,
        error,
      });

      log(`Error processing discharge requery: ${error}`);
      throw error;
    }

    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
