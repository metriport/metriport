import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PatientLoader } from "../../../command/patient-loader";
import { PatientUpdater } from "../../../command/patient-updater";
import { Capture, emptyCapture } from "../../../util/capture";
import { out } from "../../../util/log";
import { CommonWellManagementAPI } from "../management/api";
import { LinkPatients } from "../management/link-patients";
import { CoverageEnhancementParams, CoverageEnhancer } from "./coverage-enhancer";
import { ECUpdater } from "./ec-updater";

dayjs.extend(duration);

/**
 * Implementation of the Enhanced Coverage flow with the logic running on local environment.
 */
export class CoverageEnhancerLocal extends CoverageEnhancer {
  private readonly linkPatients: LinkPatients;

  constructor(
    private readonly cwManagementApi: CommonWellManagementAPI,
    patientLoader: PatientLoader,
    private readonly patientUpdater: PatientUpdater,
    private readonly ecUpdater: ECUpdater,
    private readonly capture: Capture = emptyCapture,
    private readonly prefix = ""
  ) {
    super({ patientLoader });
    this.linkPatients = new LinkPatients(this.cwManagementApi, this.patientUpdater, this.ecUpdater);
  }

  public override async enhanceCoverage({
    ecId: ecIdParam,
    cxId,
    orgOID,
    patientIds,
    fromOrgChunkPos = 0,
    stopOnErrors = false,
  }: CoverageEnhancementParams): Promise<string> {
    const startedAt = Date.now();
    const ecId = ecIdParam ?? super.makeId();
    const { log } = out(`${this.prefix}EC ${ecId} - cx ${cxId}`);
    try {
      const { total, chunks } = await this.getCarequalityOrgs({
        cxId,
        patientIds,
        fromOrgChunkPos,
      });

      log(`CQ orgs: ${total}, chunks: ${chunks.length}/${chunks.length + fromOrgChunkPos}`);
      log(`patients: ${patientIds.join(", ")}`);

      const originalOrgs =
        (await this.cwManagementApi.getIncludeList({ oid: orgOID }).catch(error => {
          // intentionally ignoring the error so we can keep trying to EC
          const msg = "Error trying to load original CW CQ include list";
          const extra = { cxId, orgOID, patientIds, error };
          log(msg, extra, error);
          this.capture.message(msg, { extra, level: "error" });
        })) ?? [];

      for (const [i, orgChunk] of chunks.entries()) {
        const orgIds = orgChunk.map(org => org.id);
        log(
          `--------------------------------- Starting chunk ${i}/${chunks.length - 1} (relative)`
        );
        try {
          await this.linkPatients.linkPatientsToOrgs({
            ecId,
            cxId,
            cxOrgOID: orgOID,
            patientIds,
            cqOrgIds: orgIds,
            log,
          });
        } catch (error) {
          const msg = `ERROR at org chunk (relative): ${i}, (absolute): ${i + fromOrgChunkPos}`;
          this.capture.message(`Error processing Enhance Coverage chunk`, {
            extra: { msg, cxId, orgOID, continuing: !stopOnErrors },
            level: "warning",
          });
          if (stopOnErrors) {
            log(`${msg} - interrupting... ${JSON.stringify(error)}`);
            throw error;
          }
          log(`${msg} - continuing... ${JSON.stringify(error)}`);
        }
      }

      // intentionally asynchronous
      if (originalOrgs.length > 1) {
        log(`(async) Revert the list of CQ orgs to the original ones...`);
        this.cwManagementApi
          .updateIncludeList({ oid: orgOID, careQualityOrgIds: originalOrgs })
          .catch(error => {
            const msg = "Error trying to RESTORE the original CW CQ include list";
            const extra = { cxId, orgOID, patientIds, error };
            log(msg, extra, error);
            this.capture.message(msg, { extra, level: "error" });
          });
      } else {
        log(`Not reverting the list of CQ orgs b/c it was originally empty.`);
      }
    } finally {
      const duration = Date.now() - startedAt;
      const durationMin = dayjs.duration(duration).asMinutes();
      log(`Patient linking time: ${duration} ms / ${durationMin} min`);
    }
    return ecId;
  }
}
