import { Config } from "../../util/config";
import { SftpClient } from "../sftp/client";
// import { LocalReplica } from "../sftp/replica/local";
// import { S3Replica } from "../sftp/replica/s3";
import { buildRequestFileName } from "./file/file-names";
import { toQuestRequestFile } from "./file/file-generator";
import {
  QuestBatchRequestData,
  QuestJob,
  QuestPatientRequestData,
  QuestRequesterData,
  QuestSftpConfig,
} from "./types";
import { buildLexicalIdGenerator, LexicalIdGenerator } from "@metriport/shared/common/lexical-id";
import { validateNPI } from "@metriport/shared/common/validate-npi";
import { MetriportError } from "@metriport/shared/dist/error/metriport-error";

export class QuestSftpClient extends SftpClient {
  private readonly generatePatientId: LexicalIdGenerator;

  constructor(config: QuestSftpConfig = {}) {
    super({
      ...config,
      host: config.host ?? Config.getQuestSftpHost(),
      port: 11022,
      username: config.username ?? Config.getQuestSftpUsername(),
      password: config.password ?? Config.getQuestSftpPassword(),
    });

    this.generatePatientId = buildLexicalIdGenerator(15);

    // this.replica =
    //   config.local && config.localPath
    //     ? new LocalReplica(config.localPath)
    //     : new S3Replica({
    //         bucketName: config.replicaBucket ?? Config.getQuestReplicaBucketName(),
    //         region: config.replicaBucketRegion ?? Config.getAWSRegion(),
    //       });
  }

  // async sendBatchRequest(request: QuestBatchRequestData) {
  //   const batchRequestFileName = buildRequestFileName(request.cxId, request.patientIds.join(","));
  //   const batchRequestFileContent = this.generateRequestFile(request);
  //   await this.writeToQuest(batchRequestFileName, batchRequestFileContent);
  // }

  async sendBatchRequest(request: QuestBatchRequestData) {
    console.log("sendBatchRequest", request);
    // const batchRequestFileName = buildRequestFileName({});
    // const batchRequestFileContent = this.generateRequestFile(request);
    // await this.writeToQuest(batchRequestFileName, batchRequestFileContent);
  }

  async sendPatientRequest(request: QuestPatientRequestData): Promise<QuestJob> {
    this.validateRequester(request);

    const patientId = request.patient.id;
    const mappedPatientId = this.generatePatientId().toString("ascii");
    const requestFileName = buildRequestFileName({
      cxId: request.cxId,
      patientId,
      mappedPatientId,
    });
    const requestFileContent = this.generateRequestFile(request);
    await this.writeToQuest(requestFileName, requestFileContent);

    return {
      cxId: request.cxId,
      facilityId: request.facility.id,
      transmissionId: request.patient.id,
      populationId: request.patient.id,
    };
  }

  async receiveResponse(job: QuestJob) {
    console.log("receiveResponse", job);
  }

  generateRequestFile(request: QuestPatientRequestData) {
    return toQuestRequestFile([request.patient]);
  }

  // async receiveResponseFile(fileName: string) {
  //   const responseFile = await this.replica.readFile(fileName);
  //   return fromQuestResponseFile(responseFile);
  // }

  async writeToQuest(fileName: string, fileContent: Buffer) {
    await this.write(`/IN/${fileName}`, fileContent);
  }

  async readFromQuest(fileName: string) {
    return await this.read(`/IN/${fileName}`);
  }

  /**
   * @param requester the requester data for Surescripts data
   * @throws an error if the requester's NPI is invalid
   */
  private validateRequester(requester: QuestRequesterData): void {
    if (!validateNPI(requester.facility.npi)) {
      this.log(`Invalid NPI "${requester.facility.npi}" for CX ID "${requester.cxId}"`);
      throw new MetriportError("Invalid NPI", undefined, {
        npiNumber: requester.facility.npi,
        cxId: requester.cxId,
      });
    }
  }
}
