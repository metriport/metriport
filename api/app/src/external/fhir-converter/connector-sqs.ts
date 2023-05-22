import { Config } from "../../shared/config";
import { sendMessageToQueue } from "../aws/sqs";
import { FHIRConverterConnector, FHIRConverterRequest } from "./connector";
import { buildUrl } from "./connector-http";

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
  }: FHIRConverterRequest): Promise<void> {
    const queueUrl = Config.getFHIRConverterQueueURL();
    if (!queueUrl) {
      console.log(`FHIR_CONVERTER_QUEUE_URL is not configured, skipping FHIR conversion...`);
      return;
    }
    // TODO 706 Remove this when the converter is ready to pull messages from the queue
    // Useful for the FHIR server, though
    const fhirConverterUrl = Config.getFHIRConverterServerURL();
    if (!fhirConverterUrl) {
      console.log(`FHIR_CONVERTER_SERVER_URL is not configured, skipping FHIR conversion...`);
      return;
    }
    const serverUrl = buildUrl(fhirConverterUrl, sourceType, template);

    await sendMessageToQueue(queueUrl, payload, {
      messageGroupId: "fhirConverterGroupId",
      messageDeduplicationId: documentId,
      messageAttributes: {
        cxId,
        serverUrl,
        sourceType,
        template,
        unusedSegments,
        invalidAccess,
        patientId,
      },
    });
  }
}
