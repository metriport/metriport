import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { PatientLoaderMetriportAPI } from "../../../patient-loader-metriport-api";
import {
  IngestConsolidated,
  IngestConsolidatedParams,
  IngestConsolidatedResult,
  IngestMultipleConsolidatedParams,
} from "./ingest-consolidated";
import { ingestPatientConsolidated } from "./ingest-lexical";

/**
 * Ingests a patient's consolidated data directly into OpenSearch.
 */
export class IngestConsolidatedDirect implements IngestConsolidated {
  private readonly patientLoader: PatientLoaderMetriportAPI;

  constructor(private readonly apiUrl = Config.getApiUrl()) {
    this.patientLoader = new PatientLoaderMetriportAPI(this.apiUrl);
  }

  async ingestConsolidatedIntoSearchEngine({
    cxId,
    patientId,
  }: IngestConsolidatedParams): Promise<IngestConsolidatedResult>;

  async ingestConsolidatedIntoSearchEngine({
    cxId,
    patientIds,
  }: IngestMultipleConsolidatedParams): Promise<IngestConsolidatedResult>;

  async ingestConsolidatedIntoSearchEngine(
    params: IngestConsolidatedParams | IngestMultipleConsolidatedParams
  ): Promise<IngestConsolidatedResult> {
    if ("patientIds" in params) {
      for (const patientId of params.patientIds) {
        await this.ingestSingle({ cxId: params.cxId, patientId });
      }
    } else {
      await this.ingestSingle(params);
    }
    return true;
  }

  private async ingestSingle({
    cxId,
    patientId,
  }: IngestConsolidatedParams): Promise<IngestConsolidatedResult> {
    const { log } = out(`cx ${cxId}, pt ${patientId}`);

    const patient = await this.patientLoader.getOneOrFail({ cxId, id: patientId });

    log(`Retrieved patient, indexing its consolidated data...`);
    await ingestPatientConsolidated({ patient });

    log(`Done`);
    return true;
  }
}
