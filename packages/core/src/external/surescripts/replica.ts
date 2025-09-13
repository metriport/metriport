import { Config } from "../../util/config";
import { S3Replica } from "../sftp/replica/s3";
import { SurescriptsFileIdentifier, SurescriptsSftpConfig } from "./types";
import { buildRequestFileName, buildResponseFileNamePrefix } from "./file/file-names";
import { decompressGzip } from "../../util/compression";
import { INCOMING_NAME } from "./constants";

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
      INCOMING_NAME,
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
    const responseFileNames = await this.listFileNamesWithPrefix(INCOMING_NAME, prefix);
    const responseFile = responseFileNames[0];
    if (!responseFile) {
      return undefined;
    }
    const fileContent = await this.readFile(responseFile);
    return decompressGzip(fileContent);
  }

  async getRawResponseFileByKey(key: string): Promise<Buffer | undefined> {
    const fileContent = await this.readFile(key);
    return decompressGzip(fileContent);
  }

  async listResponseFiles(): Promise<
    Array<{ key: string; transmissionId: string; patientId: string }>
  > {
    const responseFiles = await this.listFileNames(INCOMING_NAME);
    const startIndex = INCOMING_NAME.length + 1;
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
