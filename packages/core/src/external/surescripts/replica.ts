import { Config } from "../../util/config";
import { S3Replica } from "../sftp/replica/s3";
import { SurescriptsFileIdentifier, SurescriptsSftpConfig } from "./types";
import { buildRequestFileName, buildResponseFileNamePrefix } from "./file/file-names";
// import { decompressGzip } from "../sftp/compression";

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
    return await this.readFile(responseFile);
    // const fileContent = await this.readFile(responseFile);
    // return decompressGzip(fileContent);
  }
}
