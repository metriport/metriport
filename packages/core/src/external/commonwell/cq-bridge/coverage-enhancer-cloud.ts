import { sha256 } from "../../../util/hash";
import { SQSClient } from "../../aws/sqs";
import { CoverageEnhancementParams, CoverageEnhancer } from "./coverage-enhancer";
import { Input } from "./cq-link-patients";
import { getOrgChunksFromPos } from "./get-orgs";

/**
 * Implementation of the Enhanced Coverage flow with the logic running on AWS lambdas.
 */
export class CoverageEnhancerCloud extends CoverageEnhancer {
  private readonly sqsClient: SQSClient;

  constructor(region: string, private readonly patientLinkQueueUrl: string) {
    super();
    this.sqsClient = new SQSClient({ region });
  }

  public override async enhanceCoverage({
    cxId,
    orgOID,
    patientIds,
    fromOrgChunkPos,
  }: CoverageEnhancementParams) {
    const { chunks } = await getOrgChunksFromPos({ fromPos: fromOrgChunkPos });

    // Each chunk of CQ orgs
    for (const cqOrgList of chunks) {
      await this.sendEnhancedCoverageByCxAndChunk({
        cxId,
        orgOID,
        patientIds,
        cqOrgIds: cqOrgList.map(o => o.Id),
      });
    }
    await this.sendEnhancedCoverageDone(cxId, patientIds);
  }

  // for each patientId, send a message to SQS with the patientId and the orgChunks
  private async sendEnhancedCoverageByCxAndChunk({
    cxId,
    orgOID,
    patientIds,
    cqOrgIds,
  }: {
    cxId: string;
    orgOID: string;
    patientIds: string[];
    cqOrgIds: string[];
  }) {
    const payload: Input = {
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
