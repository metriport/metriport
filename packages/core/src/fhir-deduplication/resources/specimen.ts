import { MetriportError } from "@metriport/shared";
import { Specimen } from "@medplum/fhirtypes";
import { DisjointSetUnion } from "../disjoint-set-union";
import { sameResourceIdentifier } from "../comparators";
import { compareSpecimensByStatus } from "../../external/fhir/resources/specimen";
import { DeduplicationResult, mergeIntoTargetResource } from "../shared";

export function deduplicateSpecimens(specimens: Specimen[]): DeduplicationResult<Specimen> {
  const dsu = new DisjointSetUnion({
    resourceType: "Specimen",
    resources: specimens,
    hashKeyGenerators: [],
    comparators: [sameResourceIdentifier],
    merge: mergeSpecimens,
  });

  return dsu.deduplicate();
}

function mergeSpecimens(specimens: Specimen[]): Specimen {
  specimens.sort(compareSpecimensByStatus);
  const masterSpecimen = specimens[specimens.length - 1];
  if (!masterSpecimen) {
    throw new MetriportError("merge is always called with at least one resource");
  }

  for (let i = 0; i < specimens.length - 1; i++) {
    const specimen = specimens[i];
    if (!specimen) continue;
    mergeIntoTargetResource(masterSpecimen, specimen);
  }
  return masterSpecimen;
}
