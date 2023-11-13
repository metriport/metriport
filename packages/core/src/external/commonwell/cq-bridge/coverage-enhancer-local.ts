import { PatientUpdater } from "../../../domain/patient/patient-updater";
import { out } from "../../../util/log";
import { CommonWellManagementAPI } from "../management/api";
import { LinkPatients } from "../management/link-patients";
import { CoverageEnhancementParams, CoverageEnhancer } from "./coverage-enhancer";
import { getOrgChunksFromPos } from "./get-orgs";

/**
 * Implementation of the Enhanced Coverage flow with the logic running on local environment.
 */
export class CoverageEnhancerLocal extends CoverageEnhancer {
  private readonly linkPatients: LinkPatients;

  constructor(
    private readonly cwManagementApi: CommonWellManagementAPI,
    private readonly patientUpdater: PatientUpdater,
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
  }: CoverageEnhancementParams) {
    const startedAt = Date.now();
    const { log } = out(`${this.prefix}EC - MAIN - cx ${cxId}`);
    try {
      const { total, chunks } = await getOrgChunksFromPos({ fromPos: fromOrgChunkPos });

      log(
        `# of patients: ${patientIds.length}, CQ orgs: ${total}, ` +
          `total chunks (absolute): ${chunks.length + fromOrgChunkPos}, ` +
          `chunks to process (relative): ${chunks.length}`
      );

      for (const [i, orgChunk] of chunks.entries()) {
        const orgIds = orgChunk.map(org => org.Id);
        log(`--------------------------------- Starting chunk ${i}/${chunks.length} (relative)`);
        try {
          // log(
          //   `==================> would be linking now, mimicking some delay... (${orgIds.length}, linkPatients ${this.linkPatients})`
          // );
          await this.linkPatients.linkPatientsToOrgs({
            cxId,
            cxOrgOID: orgOID,
            patientIds,
            cqOrgIds: orgIds,
          });
        } catch (error) {
          log(
            `ERROR - stopped at org chunk ${i} (relative) / ${i + fromOrgChunkPos} (absolute)`,
            error
          );
          throw error;
        }
      }
    } finally {
      log(`Patient linking time: ${Date.now() - startedAt} ms`);
    }
  }
}
