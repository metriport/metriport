import { SurescriptsRosterType } from "@metriport/shared/interface/external/surescripts/roster";
import { decompressGzip } from "../../util/compression";
import { Config } from "../../util/config";
import { S3Replica } from "../sftp/replica/s3";
import { INCOMING_NAME } from "./constants";
import { buildPatientResponseFileName, buildResponseFileNamePrefix } from "./file/file-names";
import { SurescriptsFileIdentifier, SurescriptsSftpConfig } from "./types";

export const SURESCRIPTS_PATIENT_RESPONSE_DIRECTORY = "surescripts_patient_response_files";

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
  async getRawResponseFile({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<Buffer | undefined> {
    const prefix = buildResponseFileNamePrefix(transmissionId, populationId);
    const responseFileNames = await this.listFileNamesWithPrefix(INCOMING_NAME, prefix);
    const responseFile = responseFileNames[0];
    if (!responseFile) return undefined;
    const fileContent = await this.readFile(responseFile);
    return decompressGzip(fileContent);
  }

  async uploadPatientResponseFile({
    cxId,
    patientId,
    transmissionId,
    populationId,
    rosterType,
    fileContent,
  }: {
    cxId: string;
    patientId: string;
    transmissionId: string;
    populationId: string;
    rosterType: SurescriptsRosterType;
    fileContent: Buffer;
  }): Promise<void> {
    const fileName = buildPatientResponseFileName({
      cxId,
      patientId,
      transmissionId,
      populationId,
      rosterType,
    });
    await this.writeFile(`${SURESCRIPTS_PATIENT_RESPONSE_DIRECTORY}/${fileName}`, fileContent);
  }

  async getPatientResponseFile({
    cxId,
    patientId,
    transmissionId,
    populationId,
    rosterType,
  }: {
    cxId: string;
    patientId: string;
    transmissionId: string;
    populationId: string;
    rosterType: SurescriptsRosterType;
  }): Promise<Buffer> {
    const fileName = buildPatientResponseFileName({
      cxId,
      patientId,
      transmissionId,
      populationId,
      rosterType,
    });
    return await this.readFile(`${SURESCRIPTS_PATIENT_RESPONSE_DIRECTORY}/${fileName}`);
  }
}
