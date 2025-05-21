import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { PatientLoaderMetriportAPI } from "../../../patient-loader-metriport-api";
import {
  IngestConsolidated,
  IngestConsolidatedParams,
  IngestConsolidatedResult,
} from "./ingest-consolidated";
import { ingestLexical } from "./ingest-lexical";
import { ingestLexicalFhir } from "./ingest-lexical-fhir";

/**
 * Ingests a patient's consolidated data directly into OpenSearch.
 *
 * WIP: Currently ingesting in both indexes, text only and text+fhir!
 */
export class IngestConsolidatedDirect implements IngestConsolidated {
  constructor(private readonly apiUrl = Config.getApiUrl()) {}

  async ingestIntoSearchEngine({
    cxId,
    patientId,
  }: IngestConsolidatedParams): Promise<IngestConsolidatedResult> {
    const { log } = out(`cx ${cxId}, pt ${patientId}`);

    const patientLoader = new PatientLoaderMetriportAPI(this.apiUrl);
    const patient = await patientLoader.getOneOrFail({ cxId, id: patientId });

    log(`Retrieved patient, indexing its consolidated data...`);
    // TODO eng-268 temporary while we don't choose one approach - REMOVE THE ONE NOT BEING USED
    await Promise.all([ingestLexical({ patient }), ingestLexicalFhir({ patient })]);

    log(`Done`);
    return true;
  }
}
