import { Config } from "../../../util/config";
import { S3Utils } from "../../../external/aws/s3";

import { SurescriptsSftpClient, Transmission, TransmissionType } from "./client";

type SurescriptsDirectory = "from_surescripts" | "to_surescripts";

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

  async synchronize(dryRun = false) {
    await this.copyFromSurescripts("from_surescripts", dryRun);
    // TODO: copy outgoing messages from history folder
  }

  async copyFromSurescripts(directory: SurescriptsDirectory, dryRun = false) {
    await this.sftpClient.connect();
    const sftpFiles = await this.sftpClient.list("/" + directory);
    const s3Files = await this.s3.listObjects(this.bucket, directory + "/");
    const s3FileSet = new Set(s3Files.map(file => file.Key));

    for (const file of sftpFiles) {
      const key = directory + "/" + file;

      if (s3FileSet.has(key)) {
        console.log(`File ${key} exists in S3`);
      } else if (dryRun) {
        console.log(`Will copy:    SFTP /${directory}/${file} --> S3 ${key}`);
      } else {
        const content = await this.sftpClient.read(`/${directory}/${file}`);
        console.log("Read " + content.length + " bytes from SFTP");
        await this.s3.uploadFile({
          bucket: this.bucket,
          key,
          file: content,
        });
      }
    }
  }
}
