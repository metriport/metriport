import { Patient } from "@metriport/core/domain/patient";
import { searchLexical } from "@metriport/core/external/opensearch/lexical/search";
import { SearchSetBundle } from "@metriport/shared/medical";
import { getConsolidatedPatientData } from "../consolidated-get";

export async function searchConsolidated({
  patient,
  query,
}: {
  patient: Patient;
  query: string | undefined;
}): Promise<SearchSetBundle> {
  const result = query
    ? await searchLexical({ patient, query })
    : await getConsolidatedPatientData({ patient });
  return result;
}
