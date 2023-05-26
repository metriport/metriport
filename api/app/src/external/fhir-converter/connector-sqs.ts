import { Config } from "../../shared/config";
import { sendMessageToQueue } from "../aws/sqs";
import { FHIRConverterConnector, FHIRConverterRequest } from "./connector";
import { buildUrl } from "./connector-http";

export class FHIRConverterConnectorSQS implements FHIRConverterConnector {
  async requestConvert({
    cxId,
    patientId,
    sourceType,
    payload,
    template,
    unusedSegments,
    invalidAccess,
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
        startedAt: new Date().toISOString(),
      },
    });
  }
}
