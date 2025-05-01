import { createJobId } from "@metriport/core/domain/job";
import { out } from "@metriport/core/util/log";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Config } from "../../shared/config";
import { sendMessageToQueue } from "../aws/sqs";
import { FHIRConverterConnector, FHIRConverterRequest } from "./connector";
import { buildUrl } from "./connector-http";

dayjs.extend(utc);

export class FHIRConverterConnectorSQS implements FHIRConverterConnector {
  async requestConvert({
    cxId,
    patientId,
    requestId,
    documentId,
    sourceType,
    payload,
    template,
    unusedSegments,
    invalidAccess,
    source,
  }: FHIRConverterRequest): Promise<void> {
    const { log } = out(
      `requestConvert - cx ${cxId}, patient ${patientId}, requestId ${requestId}, docId ${documentId}`
    );
    const queueUrl = Config.getFHIRConverterQueueURL();
    if (!queueUrl) {
      log(`FHIR_CONVERTER_QUEUE_URL is not configured, skipping FHIR conversion...`);
      return;
    }
    const fhirConverterUrl = Config.getFHIRConverterServerURL();
    if (!fhirConverterUrl) {
      log(`FHIR_CONVERTER_SERVER_URL is not configured, skipping FHIR conversion...`);
      return;
    }
    const serverUrl = buildUrl(fhirConverterUrl, sourceType, template);

    await sendMessageToQueue(queueUrl, payload, {
      messageAttributes: {
        cxId,
        serverUrl,
        unusedSegments,
        invalidAccess,
        patientId,
        jobId: createJobId(requestId, documentId),
        startedAt: dayjs.utc().toISOString(),
        ...(source && { source }),
      },
    });
  }
}
