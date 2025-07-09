import { Config } from "../../util/config";
import { SftpClient } from "../sftp/client";
// import { LocalReplica } from "../sftp/replica/local";
// import { S3Replica } from "../sftp/replica/s3";
import { buildRequestFileName } from "./file/file-names";
import { generateBatchRequestFile, generatePatientRequestFile } from "./file/file-generator";
import {
  QuestBatchRequestData,
  QuestJob,
  QuestPatientRequestData,
  QuestRequesterData,
  QuestSftpConfig,
} from "./types";
import { validateNPI } from "@metriport/shared/common/validate-npi";
import { MetriportError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";

export class QuestSftpClient extends SftpClient {
  constructor(config: QuestSftpConfig = {}) {
    super({
      ...config,
      host: config.host ?? Config.getQuestSftpHost(),
      port: 11022,
      username: config.username ?? Config.getQuestSftpUsername(),
      password: config.password ?? Config.getQuestSftpPassword(),
    });

    this.initializeS3Replica({
      bucketName: config.replicaBucket ?? Config.getQuestReplicaBucketName(),
      region: config.replicaBucketRegion ?? Config.getAWSRegion(),
    });
  }

  async sendBatchRequest(request: QuestBatchRequestData): Promise<QuestJob[]> {
    const { content, patientIdMapping } = generateBatchRequestFile(request.patients);
    const populationId = uuidv7();
    const batchRequestFileName = buildRequestFileName({
      cxId: request.cxId,
      populationId,
    });
    console.log(patientIdMapping);
    try {
      await this.connect();
      await this.writeToQuest(batchRequestFileName, content);
      return [
        {
          cxId: request.cxId,
          facilityId: request.facility.id,
          transmissionId: uuidv7(),
          populationId: request.facility.id,
        },
      ];
    } finally {
      await this.disconnect();
    }
  }

  async sendPatientRequest(request: QuestPatientRequestData): Promise<QuestJob> {
    this.validateRequester(request);

    const patientId = request.patient.id;
    const requestFileName = buildRequestFileName({
      cxId: request.cxId,
      populationId: patientId,
    });
    const { content } = generatePatientRequestFile(request.patient);
    try {
      await this.connect();
      await this.writeToQuest(requestFileName, content);
      return {
        cxId: request.cxId,
        facilityId: request.facility.id,
        transmissionId: uuidv7(),
        populationId: patientId,
      };
    } finally {
      await this.disconnect();
    }
  }

  async receiveResponse(job: QuestJob) {
    console.log("receiveResponse", job);
  }

  // async receiveResponseFile(fileName: string) {
  //   const responseFile = await this.replica.readFile(fileName);
  //   return fromQuestResponseFile(responseFile);
  // }

  async writeToQuest(fileName: string, fileContent: Buffer) {
    await this.write(`/OUT/${fileName}`, fileContent);
  }

  async readFromQuest(fileName: string) {
    return await this.read(`/OUT/${fileName}`);
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
