import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { TriggerAndQueryDocRefs } from "../../../domain/document-query/trigger-and-query";
import { PatientUpdater } from "../../../domain/patient/patient-updater";
import { executeAsynchronously } from "../../../util/concurrency";
import { out } from "../../../util/log";
import { sleep } from "../../../util/sleep";
import { CommonWellManagementAPI } from "../management/api";
import { LinkPatients } from "../management/link-patients";
import { CoverageEnhancementParams, CoverageEnhancer } from "./coverage-enhancer";
import { getOrgChunksFromPos } from "./get-orgs";

dayjs.extend(duration);

const triggerWHNotificationsToCx = true;
const WAIT_BETWEEN_LINKING_AND_DOC_QUERY = dayjs.duration({ seconds: 30 });
const DOC_QUERIES_IN_PARALLEL = 25;

export type CoverageEnhancerLocalConfig = {
  waitBetweenLinkingAndDocQuery: duration.Duration;
  docQueriesInParallel: number;
};

/**
 * Implementation of the Enhanced Coverage flow with the logic running on local environment.
 */
export class CoverageEnhancerLocal extends CoverageEnhancer {
  private readonly linkPatients: LinkPatients;

  constructor(
    private readonly cwManagementApi: CommonWellManagementAPI,
    private readonly patientUpdater: PatientUpdater,
    private readonly triggerAndQueryDocRefs: TriggerAndQueryDocRefs,
    private readonly prefix = ""
  ) {
    super();
    this.linkPatients = new LinkPatients(this.cwManagementApi, this.patientUpdater);
  }

  public override async enhanceCoverage({
    cxId,
    orgOID,
    patientIds,
    fromOrgChunkPos = 0,
    startedAt = Date.now(),
    config = {
      waitBetweenLinkingAndDocQuery: WAIT_BETWEEN_LINKING_AND_DOC_QUERY,
      docQueriesInParallel: DOC_QUERIES_IN_PARALLEL,
    },
  }: CoverageEnhancementParams & {
    startedAt?: number;
    config: CoverageEnhancerLocalConfig;
  }) {
    try {
      const { total, chunks } = await getOrgChunksFromPos({ fromPos: fromOrgChunkPos });
      console.log(`Total CQ orgs: ${total} / ${chunks.length} chunks to process`);

      for (const [i, orgChunk] of chunks.entries()) {
        const { log } = out(`CHUNK ${i}/${chunks.length}`);
        const orgIds = orgChunk.map(org => org.Id);
        log(`--------------------------------- Starting`);
        try {
          await this.linkPatients.linkPatientsToOrgs({
            cxId,
            cxOrgOID: orgOID,
            patientIds,
            cqOrgIds: orgIds,
          });
        } catch (error) {
          log(`ERROR - stopped at org chunk ${i + fromOrgChunkPos}`, error);
          throw error;
        }
      }
    } finally {
      console.log(`${this.prefix} Patient linking time: ${Date.now() - startedAt} ms`);
    }

    console.log(`Giving some time for patients to be updated @ CW...`);
    await sleep(config.waitBetweenLinkingAndDocQuery.asMilliseconds());

    console.log(`${this.prefix} Triggering doc query... - started at ${new Date().toISOString()}`);
    const dqStartedAt = Date.now();

    await executeAsynchronously(
      patientIds,
      async (patientId: string) => {
        const { docsFound } = await this.triggerAndQueryDocRefs.queryDocsForPatient({
          cxId,
          patientId,
          triggerWHNotificationsToCx,
        });
        console.log(`Done doc query for patient ${patientId}, found ${docsFound} docs`);
      },
      {
        numberOfParallelExecutions: config.docQueriesInParallel,
        maxJitterMillis: 50,
        minJitterMillis: 10,
      }
    );
    console.log(`${this.prefix} Doc query time: ${Date.now() - dqStartedAt} ms`);
  }
}
