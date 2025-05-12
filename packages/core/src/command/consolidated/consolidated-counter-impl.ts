import { countBy } from "lodash";
import { out } from "../../util/log";
import {
  ConsolidatedCounter,
  ConsolidatedCounterRequest,
  ConsolidatedCounterResponse,
} from "./consolidated-counter";
import { getConsolidatedFromS3 } from "./consolidated-filter";

export class ConsolidatedCounterImpl implements ConsolidatedCounter {
  async execute(params: ConsolidatedCounterRequest): Promise<ConsolidatedCounterResponse> {
    const { patient, resources, dateFrom, dateTo } = params;
    const { log } = out(`ConsolidatedCounterImpl - cx ${patient.cxId}, pt ${patient.id}`);

    const res = await getConsolidatedFromS3({
      cxId: patient.cxId,
      patient,
      resources,
      dateFrom,
      dateTo,
    });
    const resultingResources = (res.entry ?? []).flatMap(e => (e && e.resource ? e.resource : []));

    const counted = countBy(resultingResources, r => r.resourceType);
    log(`Counted ${resultingResources.length} resources`);

    return {
      total: resultingResources.length,
      resources: counted,
    };
  }
}
