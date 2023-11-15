import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PatientUpdater } from "../../../domain/patient/patient-updater";
import { out } from "../../../util/log";
import { CommonWellManagementAPI } from "../management/api";
import { LinkPatients } from "../management/link-patients";
import { CoverageEnhancementParams, CoverageEnhancer } from "./coverage-enhancer";
import { getOrgChunksFromPos } from "./get-orgs";

dayjs.extend(duration);

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
    stopOnErrors = false,
  }: CoverageEnhancementParams) {
    const startedAt = Date.now();
    const { log } = out(`${this.prefix}EC - MAIN - cx ${cxId}`);
    try {
      const { total, chunks } = await getOrgChunksFromPos({ fromPos: fromOrgChunkPos });

      log(`CQ orgs: ${total}, chunks: ${chunks.length}/${chunks.length + fromOrgChunkPos}`);
      log(`patients: ${patientIds.join(", ")}`);

      for (const [i, orgChunk] of chunks.entries()) {
        const orgIds = orgChunk.map(org => org.Id);
        log(`--------------------------------- Starting chunk ${i}/${chunks.length} (relative)`);
        try {
          await this.linkPatients.linkPatientsToOrgs({
            cxId,
            cxOrgOID: orgOID,
            patientIds,
            cqOrgIds: orgIds,
          });
        } catch (error) {
          const msg = `ERROR at org chunk ${i} (relative) / ${i + fromOrgChunkPos} (absolute)`;
          if (stopOnErrors) {
            log(msg + " - interrupting...", error);
            throw error;
          }
          log(msg + " - continuing...", error);
        }
      }
    } finally {
      const duration = Date.now() - startedAt;
      const durationMin = dayjs.duration(duration).asMinutes();
      log(`Patient linking time: ${duration} ms / ${durationMin} min`);
    }
  }
}
