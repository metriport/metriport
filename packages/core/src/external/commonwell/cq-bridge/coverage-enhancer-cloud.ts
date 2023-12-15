import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PatientLoader } from "../../../domain/patient/patient-loader";
import { sha256 } from "../../../util/hash";
import { out } from "../../../util/log";
import { SQSClient } from "../../aws/sqs";
import { LinkPatientsCommand } from "../management/link-patients";
import { CoverageEnhancementParams, CoverageEnhancer } from "./coverage-enhancer";
import { ChunkProgress, Input } from "./cq-link-patients";

dayjs.extend(duration);

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
    cxId,
    orgOID,
    patientIds,
    fromOrgChunkPos = 0,
  }: CoverageEnhancementParams) {
    const startedAt = Date.now();
    const { log } = out(`EC - cloud - cx ${cxId}`);
    try {
      const { total, chunks } = await this.getCarequalityOrgs({
        cxId,
        patientIds,
        fromOrgChunkPos,
      });

      log(`CQ orgs: ${total}, chunks: ${chunks.length}/${chunks.length + fromOrgChunkPos}`);
      log(`patients: ${patientIds.join(", ")}`);

      // Each chunk of CQ orgs
      for (const [i, cqOrgList] of chunks.entries()) {
        await this.sendEnhancedCoverageByCxAndChunk({
          cxId,
          cxOrgOID: orgOID,
          patientIds,
          cqOrgIds: cqOrgList.map(o => o.id),
          chunkIndex: i,
          chunkTotal: chunks.length,
        });
      }
    } finally {
      await this.sendEnhancedCoverageDone(cxId, patientIds, startedAt);

      const duration = Date.now() - startedAt;
      const durationMin = dayjs.duration(duration).asMinutes();
      log(`Time to send SQS messages: ${duration} ms / ${durationMin} min`);
    }
  }

  // for each patientId, send a message to SQS with the patientId and the orgChunks
  private async sendEnhancedCoverageByCxAndChunk(params: LinkPatientsCommand & ChunkProgress) {
    const payload: Input = {
      ...params,
      done: false,
    };
    await this.sendMessageToQueue(params.cxId, payload);
  }

  private async sendEnhancedCoverageDone(cxId: string, patientIds: string[], startedAt: number) {
    const payload: Input = {
      cxId,
      patientIds,
      done: true,
      startedAt,
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
