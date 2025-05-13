import { SearchSetBundle } from "@metriport/shared/medical";
import { Patient } from "../../../domain/patient";
import { searchLexical } from "./search-lexical";
import { getConsolidatedPatientData } from "@metriport/core/command/consolidated/consolidated-get";

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
