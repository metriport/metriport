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
    documentId,
    sourceType,
    payload,
    template,
    unusedSegments,
    invalidAccess,
    source,
  }: FHIRConverterRequest): Promise<void> {
    const queueUrl = Config.getFHIRConverterQueueURL();
    if (!queueUrl) {
      console.log(`FHIR_CONVERTER_QUEUE_URL is not configured, skipping FHIR conversion...`);
      return;
    }
    const fhirConverterUrl = Config.getFHIRConverterServerURL();
    if (!fhirConverterUrl) {
      console.log(`FHIR_CONVERTER_SERVER_URL is not configured, skipping FHIR conversion...`);
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
        jobId: documentId,
        startedAt: dayjs.utc().toISOString(),
        ...(source && { source }),
      },
      fifo: true,
      messageGroupId: documentId,
      messageDeduplicationId: documentId,
    });
  }
}
