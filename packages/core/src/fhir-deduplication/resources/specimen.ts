import { Specimen } from "@medplum/fhirtypes";
import { DisjointSetUnion } from "../disjoint-set-union";
import { sameResourceIdentifier } from "../comparators";
import { DeduplicationResult } from "../shared";
import { buildSpecimenMergeFunction } from "../merge/resource/specimen";

export function deduplicateSpecimens(specimens: Specimen[]): DeduplicationResult<Specimen> {
  const dsu = new DisjointSetUnion({
    resourceType: "Specimen",
    resources: specimens,
    hashKeyGenerators: [],
    comparators: [sameResourceIdentifier],
    merge: buildSpecimenMergeFunction(),
  });

  return dsu.deduplicate();
}
