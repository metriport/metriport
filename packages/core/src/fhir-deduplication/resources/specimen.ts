import { MetriportError } from "@metriport/shared";
import { Specimen } from "@medplum/fhirtypes";
import { DisjointSetUnion } from "../disjoint-set-union";
import { sameResourceIdentifier } from "../comparators";
import { compareSpecimensByStatus } from "../../external/fhir/resources/specimen";
import { mergeIntoTargetResource } from "../shared";

export function groupSameSpecimens(specimens: Specimen[]): {
  specimensMap: Map<string, Specimen>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const dsu = new DisjointSetUnion({
    resourceType: "Specimen",
    resources: specimens,
    hashKeyGenerators: [],
    comparators: [sameResourceIdentifier],
    merge: mergeSpecimens,
  });
  const { resourceMap, refReplacementMap, danglingReferences } = dsu.deduplicate();

  return {
    specimensMap: resourceMap,
    refReplacementMap,
    danglingReferences,
  };
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
