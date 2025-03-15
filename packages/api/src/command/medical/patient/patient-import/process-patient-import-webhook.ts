import { checkResultsExistAndReturnKey } from "@metriport/core/command/patient-import/csv/check-results-exist";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { capture, out } from "@metriport/core/util";
import { Config } from "@metriport/core/util/config";
import { errorToString } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  PatientImport,
  PatientImportStatus,
} from "@metriport/shared/domain/patient/patient-import/types";
import { WebhookMetadata } from "@metriport/shared/medical";
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

export type WebhookBulkPatientImportPayload = {
  // TODO 2330 try to add the type to the metadata so it's types are safer/stronger
  // meta: WebhookMetadata<BulkPatientImportWebhookType>;
  meta: WebhookMetadata;
  bulkPatientCreate: WebhookBulkPatientImportEntry;
};

export type WebhookBulkPatientImportEntry = {
  requestId: string;
  status: PatientImportStatus;
  result?: string | undefined;
};

export async function processPatientImportWebhook(job: PatientImport): Promise<void> {
  const { cxId, id: jobId, status, params } = job;
  const { log } = out(`processPatientImportWebhook - cx ${cxId}, job ${jobId}`);
  try {
    const settings = await getSettingsOrFail({ id: cxId });

    const presignedUrl = await getBulkPatientImportPresignedUrl(job);

    const whType = "medical.bulk-patient-create";
    const payload: WebhookBulkPatientImportPayload = {
      meta: {
        messageId: jobId,
        when: buildDayjs().toISOString(),
        type: whType,
      },
      bulkPatientCreate: {
        requestId: jobId,
        status,
        ...(presignedUrl && { result: presignedUrl }),
      },
    };
    const isWhDisabled = params.disableWebhooks;
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
    log(`Error on processPatientImportWebhook: ${errorToString(error)}`);
    capture.error(error, {
      extra: { cxId, jobId, context: `webhook.processPatientImportWebhook`, error },
    });
  }
}

async function getBulkPatientImportPresignedUrl(job: PatientImport): Promise<string | undefined> {
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
