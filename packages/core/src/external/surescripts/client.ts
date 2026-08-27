import { errorToString, MetriportError } from "@metriport/shared";
import { decompressGzip } from "../../util/compression";
import { chunk } from "lodash";
import { Config } from "../../util/config";
import { SftpClient } from "../sftp/client";
import { SftpFile } from "../sftp/types";
import { generateBatchRequestFile } from "./file/file-generator";
import { buildRequestFileName, parseResponseFileName } from "./file/file-names";
import { createIdGenerator, IdGenerator } from "./id-generator";
import { SurescriptsReplica } from "./replica";
import {
  SurescriptsBatchRequestData,
  SurescriptsEnvironment,
  SurescriptsSftpConfig,
  SurescriptsSftpFile,
} from "./types";

const maxPatientsPerFile = 1000;

export class SurescriptsSftpClient extends SftpClient {
  private generateTransmissionId: IdGenerator;

  senderId: string;
  senderPassword: string;
  receiverId: string;
  usage: SurescriptsEnvironment;

  constructor(config: SurescriptsSftpConfig = {}) {
    const privateKey = Config.isDev()
      ? undefined
      : config.privateKey ?? Config.getSurescriptsSftpPrivateKey();
    super({
      ...config,
      host: config.host ?? Config.getSurescriptsHost(),
      port: config.port ?? 22,
      username: config.username ?? Config.getSurescriptsSftpSenderId(),
      password: config.publicKey ?? Config.getSurescriptsSftpPublicKey(),
      ...(privateKey ? { privateKey } : {}),
    });
    this.setReplica(new SurescriptsReplica(config));

    // 10 byte ID generator
    this.generateTransmissionId = createIdGenerator(10);
    this.senderId = config.senderId ?? Config.getSurescriptsSftpSenderId();
    this.receiverId = config.receiverId ?? Config.getSurescriptsSftpReceiverId();
    this.senderPassword = config.senderPassword ?? Config.getSurescriptsSftpSenderPassword();
    this.usage = Config.isProduction()
      ? SurescriptsEnvironment.Production
      : SurescriptsEnvironment.Test;
  }

  /**
   * @param requestData the batch request for multiple patients
   * @returns a map of transmission IDs to their requested patient IDs, an empty object if no files were generated
   */
  async sendBatchRequest(
    requestData: SurescriptsBatchRequestData
  ): Promise<Record<string, string[]>> {
    const patientChunks = chunk(requestData.patients, maxPatientsPerFile);

    const result: Record<string, string[]> = {};

    try {
      await this.connect();

      for (const patientChunk of patientChunks) {
        try {
          const transmissionId = this.generateTransmissionId().toString("ascii");

          const { content, requestedPatientIds } = generateBatchRequestFile({
            client: this,
            transmissionId,
            ...requestData,
            patients: patientChunk,
          });

          if (!content) {
            this.log(
              `No content generated for batch request: population ${requestData.populationId}, cxId: ${requestData.cxId}`
            );
            continue;
          }

          const requestFileName = buildRequestFileName(transmissionId);
          await this.writeToSurescripts(requestFileName, content);

          this.log(
            `Wrote batch request file ${requestFileName} to Surescripts for population ${requestData.populationId}, cxId: ${requestData.cxId}`
          );

          result[transmissionId] = requestedPatientIds;
        } catch (error) {
          this.log(`Error sending batch request: ${errorToString(error)}`);
          this.log(`Affected patients: ${patientChunk.map(patient => patient.id).join(", ")}`);
          continue;
        }
      }
    } finally {
      await this.disconnect();
    }
    return result;
  }

  /**
   * Returns all new response files that have not yet been downloaded to the replica.
   * @returns an array of SurescriptsSftpFile objects
   */
  async downloadAllNewResponses(): Promise<SurescriptsSftpFile[]> {
    const newResponses: SurescriptsSftpFile[] = [];
    const responseFileNamesInReplica = await this.listResponseFileNamesFromReplica();
    const alreadyDownloadedFileNames = new Set(responseFileNamesInReplica);
    this.log(`Found ${responseFileNamesInReplica.length} response files in replica`);

    try {
      await this.connect();
      const responseFileNames = await this.listResponseFileNamesFromSurescripts();
      this.log(`Found ${responseFileNames.length} response files in Surescripts directory`);
      this.log(responseFileNames.join("\n"));

      for (const responseFileName of responseFileNames) {
        this.log(`Checking ${responseFileName}...`);
        if (alreadyDownloadedFileNames.has(responseFileName)) continue;
        const parsedFileName = parseResponseFileName(responseFileName);
        if (!parsedFileName) continue;
        const { transmissionId, populationId } = parsedFileName;
        this.log(`Downloading ${responseFileName}...`);
        const sftpFile = await this.readFromSurescripts(responseFileName);
        if (!sftpFile) continue;
        newResponses.push({
          ...sftpFile,
          transmissionId,
          populationId,
        });
        this.log(`Finished downloading ${responseFileName}`);
      }
    } catch (error) {
      throw new MetriportError(`Failed to receive new Surescripts responses`, error, {
        context: "SurescriptsSftpClient",
      });
    } finally {
      await this.disconnect();
    }
    return newResponses;
  }

  async listResponseFileNamesFromReplica(): Promise<string[]> {
    if (!this.replica) throw new MetriportError("No Surescripts replica set");
    const incomingDirectoryReplica = this.replica.getReplicaPath("/from_surescripts");
    return (await this.replica.listFileNames(incomingDirectoryReplica)).map((fileName: string) =>
      fileName.replace(`${incomingDirectoryReplica}/`, "")
    );
  }

  /**
   * Reads response files directly from the S3 replica by their exact file names.
   * Use this to reprocess files that have already been downloaded.
   */
  async readResponseFilesFromReplica(fileNames: string[]): Promise<SurescriptsSftpFile[]> {
    if (!this.replica) throw new MetriportError("No Surescripts replica set");
    const responses: SurescriptsSftpFile[] = [];
    for (const fileName of fileNames) {
      const parsedFileName = parseResponseFileName(fileName);
      if (!parsedFileName) {
        this.log(`Skipping ${fileName} - could not parse file name`);
        continue;
      }
      const { transmissionId, populationId } = parsedFileName;
      const replicaPath = this.replica.getReplicaPath(`/from_surescripts/${fileName}`);
      this.log(`Reading ${fileName} from replica at ${replicaPath}...`);
      const compressedContent = await this.replica.readFile(replicaPath);
      const content = await decompressGzip(compressedContent);
      responses.push({ fileName, content, transmissionId, populationId });
      this.log(`Finished reading ${fileName} from replica`);
    }
    return responses;
  }

  /**
   * @param fileName the file name within the /to_surescripts directory to write
   * @param content the Buffer content to write
   */
  private async writeToSurescripts(fileName: string, content: Buffer): Promise<void> {
    const remotePath = `/to_surescripts/${fileName}`;
    await this.write(remotePath, content);
  }

  /**
   * @param fileName the file name within the /from_surescripts directory to read
   * @returns the SftpFile if it exists in the replica, undefined otherwise
   */
  private async readFromSurescripts(fileName: string): Promise<SftpFile | undefined> {
    const remotePath = `/from_surescripts/${fileName}`;
    const content = await this.read(remotePath);
    return { fileName, content };
  }

  async listResponseFileNamesFromSurescripts(): Promise<string[]> {
    return await this.list("/from_surescripts");
  }
}
