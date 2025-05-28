import { Config } from "../../../util/config";
import { S3Utils } from "../../../external/aws/s3";
import { SurescriptsSftpClient, Transmission, TransmissionType } from "./client";
import { SurescriptsDirectory, SurescriptsSynchronizeEvent } from "./types";
import { INCOMING_NAME, OUTGOING_NAME, HISTORY_NAME } from "./constants";

export class SurescriptsReplica {
  private readonly s3: S3Utils;
  private readonly bucket: string;
  private readonly sftpClient: SurescriptsSftpClient;

  constructor({
    sftpClient,
    bucket,
  }: { sftpClient?: SurescriptsSftpClient; bucket?: string } = {}) {
    this.sftpClient = sftpClient ?? new SurescriptsSftpClient({});
    this.s3 = new S3Utils(process.env.AWS_REGION ?? "us-east-2");
    this.bucket = bucket ?? Config.getSurescriptsReplicaBucketName();
  }

  async writePatientLoadFileToStorage(
    transmission: Transmission<TransmissionType>,
    message: Buffer
  ) {
    const fileName = this.sftpClient.getPatientLoadFileName(transmission);
    await this.s3.uploadFile({
      bucket: this.bucket,
      key: "to_surescripts/" + fileName,
      file: message,
    });
  }

  async receiveVerificationResponse(transmission: Transmission<TransmissionType>) {
    const fileName = await this.sftpClient.findVerificationFileName(transmission);
    if (fileName) {
      const content = await this.sftpClient.read(`/${INCOMING_NAME}/${fileName}`);
      await this.s3.uploadFile({
        bucket: this.bucket,
        key: getS3Key(INCOMING_NAME, fileName),
        file: content,
      });
    }
  }

  async receiveFlatFileResponse(transmission: Transmission) {
    const fileName = await this.sftpClient.findFlatFileResponseName(transmission);
    if (fileName) {
      const content = await this.sftpClient.read(`/${INCOMING_NAME}/${fileName}`);
      await this.s3.uploadFile({
        bucket: this.bucket,
        key: getS3Key(INCOMING_NAME, fileName),
        file: content,
      });
    }
  }

  async synchronize(event: SurescriptsSynchronizeEvent) {
    if (event.fromSurescripts) {
      await this.copyFromSurescripts(event.dryRun);
    }
    if (event.toSurescripts) {
      await this.copyToSurescripts(event.dryRun);
    } else if (event.fileName) {
      await this.copyFileFromSurescripts(event.fileName, event.dryRun);
    }
  }

  async copyFromSurescripts(dryRun = false) {
    await this.sftpClient.connect();
    const sftpFiles = await this.sftpClient.list("/" + INCOMING_NAME);
    const s3Files = await this.s3.listObjects(this.bucket, INCOMING_NAME + "/");
    const s3FileSet = new Set(s3Files.map(file => file.Key));

    for (const fileName of sftpFiles) {
      const key = getS3Key(INCOMING_NAME, fileName);

      if (!s3FileSet.has(key)) {
        await this.copyFileFromSurescripts(fileName, dryRun);
      }
    }
  }

  async copyFileFromSurescripts(
    fileName: string, // the base file name, without any directory prefixes
    dryRun = false // only return the content without copying to S3
  ): Promise<Buffer | null> {
    const sftpFileName = getSftpFileName(INCOMING_NAME, fileName);
    const exists = await this.sftpClient.exists(sftpFileName);
    if (!exists) {
      return null;
    }

    const content = await this.sftpClient.read(sftpFileName);
    if (!dryRun) {
      const s3Key = getS3Key(INCOMING_NAME, fileName);
      await this.s3.uploadFile({
        bucket: this.bucket,
        key: s3Key,
        file: content,
      });
    }
    return content;
  }

  async copyToSurescripts(dryRun = false) {
    await this.sftpClient.connect();

    const sftpHistory = await this.sftpClient.list("/" + HISTORY_NAME);
    const sftpHistorySet = new Set(sftpHistory);

    const s3Files = await this.s3.listObjects(this.bucket, OUTGOING_NAME + "/");

    for (const s3File of s3Files) {
      if (!s3File.Key) continue;

      const outgoingFileName = s3File.Key.substring(OUTGOING_NAME.length + 1);
      const sftpHistoryName = `${outgoingFileName}.${this.sftpClient.senderId}`;
      if (!sftpHistorySet.has(sftpHistoryName)) {
        await this.copyFileToSurescripts(outgoingFileName, dryRun);
      }
    }
  }

  async copyFileToSurescripts(
    fileName: string, // the base file name, without any directory prefixes
    dryRun = false // only return the content without uploading to SFTP
  ): Promise<Buffer | null> {
    const s3Key = getS3Key(OUTGOING_NAME, fileName);
    const s3FileExists = await this.s3.fileExists(this.bucket, s3Key);
    if (!s3FileExists) {
      return null;
    }

    const content = await this.s3.downloadFile({
      bucket: this.bucket,
      key: s3Key,
    });

    if (!dryRun) {
      const sftpFileName = getSftpFileName(OUTGOING_NAME, fileName);
      await this.sftpClient.write(sftpFileName, content);
    }
    return content;
  }
}

function getS3Key(directory: SurescriptsDirectory, fileName: string) {
  return `${directory}/${fileName}`;
}

function getSftpFileName(directory: SurescriptsDirectory, fileName: string) {
  return `/${directory}/${fileName}`;
}
