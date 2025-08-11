import { Config } from "../../util/config";
import { S3Replica } from "../sftp/replica/s3";
import { SurescriptsFileIdentifier, SurescriptsSftpConfig } from "./types";
import { buildRequestFileName, buildResponseFileNamePrefix } from "./file/file-names";
import { compressGzip, decompressGzip } from "../sftp/compression";

export class SurescriptsReplica extends S3Replica {
  constructor(config: Pick<SurescriptsSftpConfig, "replicaBucket" | "replicaBucketRegion"> = {}) {
    super({
      bucketName: config.replicaBucket ?? Config.getSurescriptsReplicaBucketName(),
      region: config.replicaBucketRegion ?? Config.getAWSRegion(),
    });
  }

  async getRawVerificationFile(transmissionId: string): Promise<Buffer | undefined> {
    const requestFileName = buildRequestFileName(transmissionId);
    const verificationFileNames = await this.listFileNamesWithPrefix(
      "from_surescripts",
      requestFileName
    );
    const verificationFile = verificationFileNames[0];
    if (!verificationFile) {
      return undefined;
    }
    return await this.readFile(verificationFile);
  }

  /**
   * @param transmissionId - The transmission ID of the response file
   * @param populationId - The population or patient ID for the response file
   * @returns The content of the response file as an ASCII-encoded buffer
   */
  async getRawResponseFile({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<Buffer | undefined> {
    const prefix = buildResponseFileNamePrefix(transmissionId, populationId);
    const responseFileNames = await this.listFileNamesWithPrefix("from_surescripts", prefix);
    const responseFile = responseFileNames[0];
    if (!responseFile) {
      return undefined;
    }
    const fileContent = await this.readFile(responseFile);
    return decompressGzip(fileContent);
  }

  async moveXmlFileToNcpdpDirectory(key: string, fileContent: Buffer): Promise<void> {
    if (!fileContent?.toString().startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
      throw new Error("File is not XML! " + key);
    }
    const ncpdpKey = key.replace("from_surescripts/", "ncpdp/");
    const compressedContent = await compressGzip(fileContent);
    await this.writeFile(ncpdpKey, compressedContent);
    await this.s3.deleteFile({ bucket: this.bucketName, key });
    console.log("moved XML file to ncpdp directory: " + ncpdpKey);
  }

  async getRawResponseFileByKey(key: string): Promise<Buffer | undefined> {
    const fileContent = await this.readFile(key);
    return decompressGzip(fileContent);
  }

  async listResponseFiles(): Promise<
    Array<{ key: string; transmissionId: string; patientId: string }>
  > {
    const prefix = "from_surescripts/";
    const responseFiles = await this.listFileNames(prefix);
    const startIndex = prefix.length;
    return responseFiles
      .filter(key => {
        return key.charAt(startIndex + 10) === "_" && key.charAt(startIndex + 47) === "_";
      })
      .map(key => {
        const transmissionId = key.substring(startIndex, startIndex + 10);
        const patientId = key.substring(startIndex + 11, startIndex + 47);
        return {
          key,
          transmissionId,
          patientId,
        };
      });
  }
}
