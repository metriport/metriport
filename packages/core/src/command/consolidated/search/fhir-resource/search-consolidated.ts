import { SearchSetBundle } from "@metriport/shared/medical";
import { Patient } from "../../../../domain/patient";
import { getConsolidatedPatientData } from "../../consolidated-get";
import { searchLexical } from "./search-lexical";

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
