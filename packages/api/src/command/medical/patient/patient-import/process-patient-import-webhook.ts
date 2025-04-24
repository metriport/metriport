import { checkResultsExistAndReturnKey } from "@metriport/core/command/patient-import/csv/check-results-exist";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { capture, out } from "@metriport/core/util";
import { Config } from "@metriport/core/util/config";
import { errorToString } from "@metriport/shared";
import { PatientImportJob } from "@metriport/shared/domain/patient/patient-import/types";
import { WebhookBulkPatientImportPayload } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getSettingsOrFail } from "../../../settings/getSettings";
import { processRequest } from "../../../webhook/webhook";
import {
  createWebhookRequest,
  CreateWebhookRequestCommand,
} from "../../../webhook/webhook-request";

dayjs.extend(duration);

const presignedResultUrlDuration = dayjs.duration(3, "minutes");

export async function processPatientImportJobWebhook(job: PatientImportJob): Promise<void> {
  const { cxId, id: jobId, status, paramsOps } = job;
  const { log } = out(`processPatientImportJobWebhook - cx ${cxId}, job ${jobId}`);
  try {
    const settings = await getSettingsOrFail({ id: cxId });

    const presignedUrl = await getBulkPatientImportPresignedDownloadUrl(job);

    const whType = "medical.bulk-patient-create";
    // `meta` is added by processRequest()
    const payload: Omit<WebhookBulkPatientImportPayload, "meta"> = {
      bulkPatientCreate: {
        requestId: jobId,
        status,
        ...(presignedUrl && { result: presignedUrl }),
      },
    };
    const isWhDisabled = paramsOps.disableWebhooks;
    const createWebhookRequestCmd: CreateWebhookRequestCommand = {
      cxId,
      requestId: jobId,
      type: whType,
      payload,
    };
    if (!isWhDisabled) {
      log(`Sending WH...`);
      const webhookRequest = await createWebhookRequest(createWebhookRequestCmd);
      await processRequest(webhookRequest, settings);
    } else {
      log(`WH disabled. Not sending it.`);
      await createWebhookRequest({
        ...createWebhookRequestCmd,
        status: "success",
      });
    }
  } catch (error) {
    log(`Error on processPatientImportJobWebhook: ${errorToString(error)}`);
    capture.error(error, {
      extra: { cxId, jobId, context: `webhook.processPatientImportJobWebhook`, error },
    });
  }
}

async function getBulkPatientImportPresignedDownloadUrl(
  job: PatientImportJob
): Promise<string | undefined> {
  const { cxId, id: jobId, status } = job;

  if (status !== "completed") return undefined;

  const s3BucketName = Config.getPatientImportBucket();

  const key = await checkResultsExistAndReturnKey({ cxId, jobId, s3BucketName });

  const s3Utils = new S3Utils(Config.getAWSRegion());
  const s3Url = await s3Utils.getSignedUrl({
    bucketName: s3BucketName,
    fileName: key,
    durationSeconds: presignedResultUrlDuration.asSeconds(),
  });

  return s3Url;
}
