import { Config } from "../../util/config";
import { S3Replica } from "../sftp/replica/s3";
import { SurescriptsFileIdentifier, SurescriptsSftpConfig } from "./types";
import { makeResponseFileNamePrefix } from "./file-names";

export class SurescriptsReplica extends S3Replica {
  constructor(config: Pick<SurescriptsSftpConfig, "replicaBucket" | "replicaBucketRegion"> = {}) {
    super({
      bucketName: config.replicaBucket ?? Config.getSurescriptsReplicaBucketName(),
      region: config.replicaBucketRegion ?? Config.getAWSRegion(),
    });
  }

  /**
   * @param transmissionId - The transmission ID of the response file
   * @param populationId - The population or patient ID for the response file
   * @returns The content of the response file as an ASCII-encoded buffer
   */
  async getResponseFileContent({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<Buffer | undefined> {
    const prefix = makeResponseFileNamePrefix(transmissionId, populationId);
    const responseFileNames = await this.listFileNamesWithPrefix("from_surescripts", prefix);
    const responseFile = responseFileNames[0];
    if (!responseFile) {
      return undefined;
    }
    return await this.readFile(responseFile);
  }
}
