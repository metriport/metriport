import { PatientLoader } from "../../../domain/patient-loader";
import { sha256 } from "../../../util/hash";
import { SQSClient } from "../../aws/sqs";
import { CoverageEnhancementParams, CoverageEnhancer } from "./coverage-enhancer";
import { Input } from "./cq-link-patients";

/**
 * Implementation of the Enhanced Coverage flow with the logic running on AWS lambdas.
 */
export class CoverageEnhancerCloud extends CoverageEnhancer {
  private readonly sqsClient: SQSClient;

  constructor(
    region: string,
    private readonly patientLinkQueueUrl: string,
    patientLoader: PatientLoader
  ) {
    super({ patientLoader });
    this.sqsClient = new SQSClient({ region });
  }

  public override async enhanceCoverage({
    ecId: ecIdParam,
    cxId,
    orgOID,
    patientIds,
    fromOrgChunkPos = 0,
  }: CoverageEnhancementParams): Promise<string> {
    const ecId = ecIdParam ?? super.makeId();

    const { chunks } = await this.getCarequalityOrgs({ cxId, patientIds, fromOrgChunkPos });

    // Each chunk of CQ orgs
    for (const cqOrgList of chunks) {
      await this.sendEnhancedCoverageByCxAndChunk({
        ecId,
        cxId,
        orgOID,
        patientIds,
        cqOrgIds: cqOrgList.map(o => o.id),
      });
    }
    await this.sendEnhancedCoverageDone(cxId, patientIds);

    return ecId;
  }

  // for each patientId, send a message to SQS with the patientId and the orgChunks
  private async sendEnhancedCoverageByCxAndChunk({
    ecId,
    cxId,
    orgOID,
    patientIds,
    cqOrgIds,
  }: {
    ecId: string;
    cxId: string;
    orgOID: string;
    patientIds: string[];
    cqOrgIds: string[];
  }) {
    const payload: Input = {
      ecId,
      cxId,
      cxOrgOID: orgOID,
      patientIds,
      cqOrgIds,
      done: false,
    };
    await this.sendMessageToQueue(cxId, payload);
  }

  private async sendEnhancedCoverageDone(cxId: string, patientIds: string[]) {
    const payload: Input = {
      cxId,
      patientIds,
      done: true,
    };
    await this.sendMessageToQueue(cxId, payload);
  }

  private async sendMessageToQueue(cxId: string, payload: Input): Promise<void> {
    if (!this.patientLinkQueueUrl) return;

    const payloadAsString = JSON.stringify(payload);
    return this.sqsClient.sendMessageToQueue(this.patientLinkQueueUrl, payloadAsString, {
      fifo: true,
      messageGroupId: cxId,
      messageDeduplicationId: sha256(payloadAsString),
    });
  }
}
