import { Logger } from "../../util/log";
import { buildDayjs, ISO_DATE_TIME } from "@metriport/shared/src/common/date";
import { S3Utils } from "../../external/aws/s3";
import { Config } from "../../util/config";
import { createUnparseableHl7MessagePhiFileKey } from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";

export async function persistHl7Phi({
  patientId,
  stringMessage,
  logger,
}: {
  patientId: string;
  stringMessage: string;
  logger: Logger;
}) {
  const { log } = logger;
  const bucketName = Config.getHl7IncomingMessageBucketName();
  const s3Utils = new S3Utils(Config.getAWSRegion());

  const keyParams = {
    rawPtIdentifier: patientId,
    rawTimestamp: buildDayjs().format(ISO_DATE_TIME),
    messageCode: "UNK",
    triggerEvent: "UNK",
  };

  const phiFileKey = createUnparseableHl7MessagePhiFileKey(keyParams);

  log(`Uploading PHI to S3 with key: ${phiFileKey}`);
  await s3Utils.uploadFile({
    bucket: bucketName,
    key: phiFileKey,
    file: Buffer.from(stringMessage),
    contentType: "text/plain",
  });
}
