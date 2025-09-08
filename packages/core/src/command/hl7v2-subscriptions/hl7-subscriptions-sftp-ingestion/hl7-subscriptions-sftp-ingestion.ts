import { getSecretValueOrFail } from "../../../external/aws/secret-manager";
import { SftpClient } from "../../../external/sftp/client";
import { SftpConfig } from "../../../external/sftp/types";
import { Config } from "../../../util/config";
import { IdentifiedHl7Message, PsvToHl7Converter } from "./psv-to-hl7-converter";
import {
  getHl7MessageTypeOrFail,
  getMessageDatetime,
  getMessageUniqueIdentifier,
} from "../hl7v2-to-fhir-conversion/msh";
import { buildDayjs } from "@metriport/shared/common/date";
import { createFileKeyHl7Message } from "../hl7v2-to-fhir-conversion/shared";
import { Hl7NotificationSenderParams } from "../../hl7-notification/hl7-notification-webhook-sender";
import { buildHl7NotificationWebhookSender } from "../../hl7-notification/hl7-notification-webhook-sender-factory";

export type ReplicaConfig = { type: "local"; path: string } | { type: "s3"; bucketName: string };
export const HIE_NAME = "LaHie";

export class LaHieSftpClient extends SftpClient {
  private static readonly LOCAL_PATH = "/Users/radmirgaripov/Documents/Super";
  private static readonly LOCAL_PASSWORD = Config.getLaHieIngestionPassword();
  private readonly overridenLog: typeof console.log;

  private constructor(
    sftpConfig: SftpConfig,
    replica: ReplicaConfig,
    overridenLog: typeof console.log
  ) {
    super(sftpConfig);
    this.overridenLog = overridenLog;

    if (replica.type === "local") {
      this.initializeLocalReplica(replica.path);
    } else {
      const region = Config.getAWSRegion();
      this.initializeS3Replica({ bucketName: replica.bucketName, region });
    }
  }

  static async create(
    overridenLog: typeof console.log,
    isLocal?: boolean
  ): Promise<LaHieSftpClient> {
    const host = Config.getLaHieIngestionHost();
    const port = Config.getLaHieIngestionPort();
    const username = Config.getLaHieIngestionUsername();
    const password = isLocal ? this.LOCAL_PASSWORD : await this.getLaHiePassword();
    const replica = isLocal ? this.getLocalReplica() : this.getLaHieReplica();

    return new LaHieSftpClient(
      {
        host,
        port,
        username,
        password,
      },
      replica,
      overridenLog
    );
  }

  static async getLaHiePassword(): Promise<string> {
    const region = Config.getAWSRegion();
    const passwordArn = Config.getLaHieIngestionPassword();
    return await getSecretValueOrFail(passwordArn, region);
  }

  static getLocalReplica(): ReplicaConfig {
    return { type: "local", path: this.LOCAL_PATH };
  }

  static getLaHieReplica(): ReplicaConfig {
    const bucketName = Config.getLaHieIngestionBucket();
    return { type: "s3", bucketName };
  }

  async safeSync(remotePath: string): Promise<string[]> {
    this.overridenLog(`Syncing from remotePath: ${remotePath}`);
    try {
      await this.connect();

      const exists = await this.exists(`${remotePath}/`);
      if (!exists) {
        throw new Error("Remote path does not exist");
      }
      this.overridenLog("Syncing from remote path to Replica");
      const fileNames = await this.sync(`${remotePath}/`);
      return fileNames;
    } finally {
      await this.disconnect();
    }
  }

  override async syncFileToReplica(content: Buffer, remotePath: string) {
    this.overridenLog("Found a file to sync to replica");
    if (this.replica) {
      try {
        const replicaPath = this.replica.getReplicaPath(remotePath);
        this.overridenLog("Decrypting content");
        const decryptedContent = await this.decryptGpgBinaryWithPrivateKey(content);

        this.overridenLog("Syncing decrypted content to replica");
        await this.replica.writeFile(replicaPath, decryptedContent);

        this.overridenLog("Parsing content from PSV to Hl7");
        const psvToHl7Converter = new PsvToHl7Converter(decryptedContent);
        const identifiedMessages = await psvToHl7Converter.getCxIdPtIdHl7MessageList();

        this.overridenLog("Sending parsed data to webhook sender sqs");
        await sendToWebhookSender(identifiedMessages);
      } catch (error) {
        this.overridenLog(`Error writing file to replica: ${error}`);
      }
    }
  }

  private async decryptGpgBinaryWithPrivateKey(content: Buffer): Promise<Buffer> {
    return content;
  }
}

export async function sendToWebhookSender(identifiedMessages: IdentifiedHl7Message[]) {
  for (const { cxId, ptId, hl7Message } of identifiedMessages) {
    const messageId = getMessageUniqueIdentifier(hl7Message);
    const msgTimestamp = getMessageDatetime(hl7Message);
    const { messageCode, triggerEvent } = getHl7MessageTypeOrFail(hl7Message);

    const rawDataFileKey = createFileKeyHl7Message({
      cxId,
      patientId: ptId,
      timestamp: msgTimestamp ? msgTimestamp : buildDayjs(Date.now()).toISOString(),
      messageId,
      messageCode,
      triggerEvent,
    });

    const Hl7NotificationParams: Hl7NotificationSenderParams = {
      cxId,
      patientId: ptId,
      message: hl7Message.toString(),
      sourceTimestamp: msgTimestamp ? msgTimestamp : buildDayjs(Date.now()).toISOString(),
      messageReceivedTimestamp: msgTimestamp ? msgTimestamp : buildDayjs(Date.now()).toISOString(),
      rawDataFileKey: rawDataFileKey,
      hieName: HIE_NAME,
    };
    await buildHl7NotificationWebhookSender().execute(Hl7NotificationParams);
  }
}

export interface Hl7SubscriptionLaHieIngestion {
  execute(): Promise<void>;
}
