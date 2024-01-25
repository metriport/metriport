import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Config } from "../../shared/config";
import { sendMessageToQueue } from "../aws/sqs";
import { SidechainFHIRConverterConnector, SidechainFHIRConverterRequest } from "./connector";

dayjs.extend(utc);

export class SidechainFHIRConverterConnectorSQS implements SidechainFHIRConverterConnector {
  async requestConvert({
    cxId,
    patientId,
    documentId,
    payload,
    requestId,
    source,
  }: SidechainFHIRConverterRequest): Promise<void> {
    const queueUrl = Config.getSidechainFHIRConverterQueueURL();
    if (!queueUrl) {
      console.log(
        `SIDECHAIN_FHIR_CONVERTER_QUEUE_URL is not configured, skipping FHIR conversion...`
      );
      return;
    }

    await sendMessageToQueue(queueUrl, payload, {
      messageAttributes: {
        cxId,
        patientId,
        jobId: `${requestId}_${documentId}`,
        startedAt: dayjs.utc().toISOString(),
        ...(source && { source }),
      },
    });
  }
}
