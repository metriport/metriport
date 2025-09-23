import { Hl7Message, Hl7Segment, Hl7Field } from "@medplum/core";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import {
  HIE_NAME,
  Hl7AlohrSftpIngestion,
  Hl7AlohrSftpIngestionParams,
  log,
  TimestampedMessage,
} from "./hl7-alohr-sftp-ingestion";
import { AlohrSftpIngestionClient } from "./hl7-alohr-sftp-ingestion-client";
import { buildHl7NotificationWebhookSender } from "../../hl7-notification/hl7-notification-webhook-sender-factory";
import { Hl7NotificationSenderParams } from "../../hl7-notification/hl7-notification-webhook-sender";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  getCxIdAndPatientIdOrFail,
  getSegmentByNameOrFail,
} from "../../hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { asString } from "../../hl7-notification/utils";

export class Hl7AlohrSftpIngestionDirect implements Hl7AlohrSftpIngestion {
  private readonly ALTERNATE_PATIENT_ID_FIELD_INDEX = 4; // 1 indexed
  private readonly PATIENT_ID_FIELD_INDEX = 3; // 1 indexed

  private sftpClient: AlohrSftpIngestionClient;

  constructor(sftpClient: AlohrSftpIngestionClient) {
    this.sftpClient = sftpClient;
  }

  async execute(params: Hl7AlohrSftpIngestionParams): Promise<void> {
    const s3Utils = new S3Utils(Config.getAWSRegion());
    const bucketName = Config.getAlohrIngestionBucket();
    const remotePath = Config.getAlohrIngestionRemotePath();

    log("Beginning ingestion from Alohr");
    const fileNames = await this.sftpClient.safeSyncWithDate(
      remotePath,
      params.startingDate,
      params.endingDate
    );

    log(`Reading synced files`);
    const timestampedMessages: TimestampedMessage[] = [];

    for (const fileName of fileNames) {
      const filePath = this.getFilePath(remotePath, fileName);
      const existsFile = await s3Utils.fileExists(bucketName, filePath);
      if (!existsFile) {
        throw new Error(`File ${filePath} does not exist`);
      }

      const message = await s3Utils.getFileContentsAsString(bucketName, filePath);
      const recievedAt = buildDayjs(Date.now()).toISOString();
      const hl7Message = Hl7Message.parse(message);

      const remappedMessage = this.remapMessage(hl7Message);
      const remappedMessageString = asString(remappedMessage);
      const { cxId, patientId } = getCxIdAndPatientIdOrFail(remappedMessage);

      timestampedMessages.push({
        message: remappedMessageString,
        timestamp: recievedAt,
        cxId: cxId,
        patientId: patientId,
      });
    }

    log(`Sending to webhook sender`);
    await this.sendToWebhookSender(timestampedMessages);
  }

  private async sendToWebhookSender(timestampedMessages: TimestampedMessage[]): Promise<void> {
    for (const msg of timestampedMessages) {
      const webhookSender = buildHl7NotificationWebhookSender();
      const webhookSenderParams: Hl7NotificationSenderParams = {
        cxId: msg.cxId,
        patientId: msg.patientId,
        message: msg.message,
        messageReceivedTimestamp: msg.timestamp,
        hieName: HIE_NAME,
      };

      await webhookSender.execute(webhookSenderParams);
    }
  }

  private getFilePath(remotePath: string, fileName: string): string {
    return `${remotePath}/${fileName}`.replace(/^\//, "");
  }

  private remapMessage(message: Hl7Message): Hl7Message {
    const remappedPid = this.remapPidField(message);
    const newSegments = message.segments.map(segment => {
      if (segment.name === "PID") {
        return remappedPid;
      }
      return segment;
    });

    return new Hl7Message(newSegments, message.context);
  }

  /**
   * Remaps the PID field by swapping the patient id (index 3) with the alternate patient id (index 4)
   * @param message The HL7 Message to remap
   * @returns The remapped PID segment
   */
  private remapPidField(message: Hl7Message): Hl7Segment {
    const pid = getSegmentByNameOrFail(message, "PID");

    const patientIdField = pid.getField(this.PATIENT_ID_FIELD_INDEX);
    const alternatePatientIdField = pid.getField(this.ALTERNATE_PATIENT_ID_FIELD_INDEX);

    const originalPatientId = patientIdField.getComponent(1).toString();
    const metriportId = alternatePatientIdField.getComponent(1).toString();

    const newPatientIdField = new Hl7Field([[metriportId]], pid.context);
    const newAlternatePatientIdField = new Hl7Field([[originalPatientId]], pid.context);

    const newFields = [...pid.fields];
    newFields[this.PATIENT_ID_FIELD_INDEX] = newPatientIdField;
    newFields[this.ALTERNATE_PATIENT_ID_FIELD_INDEX] = newAlternatePatientIdField;

    return new Hl7Segment(newFields, pid.context);
  }
}
