import { Config } from "../../util/config";
import { SftpClient } from "../sftp/client";
// import { LocalReplica } from "../sftp/replica/local";
// import { S3Replica } from "../sftp/replica/s3";
import { buildRequestFileName, buildResponseFileName } from "./file/file-names";
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
import { buildDayjs } from "@metriport/shared/common/date";

export class QuestSftpClient extends SftpClient {
  private readonly outgoingDirectory: string;
  private readonly incomingDirectory: string;

  constructor(config: QuestSftpConfig = {}) {
    super({
      ...config,
      host: config.host ?? Config.getQuestSftpHost(),
      port: config.port ?? Config.getQuestSftpPort(),
      username: config.username ?? Config.getQuestSftpUsername(),
      password: config.password ?? Config.getQuestSftpPassword(),
    });
    this.outgoingDirectory = config.outgoingDirectory ?? Config.getQuestSftpOutgoingDirectory();
    this.incomingDirectory = config.incomingDirectory ?? Config.getQuestSftpIncomingDirectory();

    this.initializeS3Replica({
      bucketName: config.replicaBucket ?? Config.getQuestReplicaBucketName(),
      region: config.replicaBucketRegion ?? Config.getAWSRegion(),
    });
  }

  async sendBatchRequest(request: QuestBatchRequestData): Promise<QuestJob[]> {
    this.validateRequester(request);

    const { content, patientIdMap } = generateBatchRequestFile(request.patients);
    const populationId = uuidv7();
    const dateString = buildDayjs().format("YYYYMMDD");
    const batchRequestFileName = buildRequestFileName({
      populationId,
      dateString,
    });
    try {
      await this.connect();
      await this.writeToQuest(batchRequestFileName, content);
      return [
        {
          cxId: request.cxId,
          facilityId: request.facility.id,
          populationId,
          patientIdMap,
          dateString,
        },
      ];
    } finally {
      await this.disconnect();
    }
  }

  async sendPatientRequest(request: QuestPatientRequestData): Promise<QuestJob> {
    this.validateRequester(request);

    const patientId = request.patient.id;
    const dateString = buildDayjs().format("YYYYMMDD");
    const requestFileName = buildRequestFileName({
      populationId: patientId,
      dateString,
    });
    const { content, patientIdMap } = generatePatientRequestFile(request.patient);
    try {
      await this.connect();
      await this.writeToQuest(requestFileName, content);
      await this.replica?.writeFile(`to_quest/${requestFileName}`, content);
      return {
        cxId: request.cxId,
        facilityId: request.facility.id,
        populationId: patientId,
        patientIdMap,
        dateString,
      };
    } finally {
      await this.disconnect();
    }
  }

  async receiveResponse(job: QuestJob) {
    const responseFileName = buildResponseFileName({
      populationId: job.populationId,
      dateString: job.dateString,
    });

    if (await this.hasResponseFileInReplica(responseFileName)) {
      return await this.readResponseFileFromReplica(responseFileName);
    }

    try {
      await this.connect();
      const responseFile = await this.readFromQuest(responseFileName);
      await this.writeResponseFileToReplica(responseFileName, responseFile);
      return responseFile;
    } finally {
      await this.disconnect();
    }
  }

  private async hasResponseFileInReplica(fileName: string) {
    return await this.replica?.hasFile(`from_quest/${fileName}`);
  }

  private async readResponseFileFromReplica(fileName: string) {
    return await this.replica?.readFile(`from_quest/${fileName}`);
  }

  private async writeResponseFileToReplica(fileName: string, fileContent: Buffer) {
    await this.replica?.writeFile(`from_quest/${fileName}`, fileContent);
  }

  async writeToQuest(fileName: string, fileContent: Buffer) {
    await this.write(`${this.outgoingDirectory}/${fileName}`, fileContent);
  }

  async readFromQuest(fileName: string) {
    return await this.read(`${this.incomingDirectory}/${fileName}`);
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
