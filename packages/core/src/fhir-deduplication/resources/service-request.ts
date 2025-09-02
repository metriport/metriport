import { ServiceRequest } from "@medplum/fhirtypes";
import { DisjointSetUnion } from "../disjoint-set-union";
import { sameResourceId, sameResourceIdentifier } from "../comparators";

export function groupSameServiceRequests(serviceRequests: ServiceRequest[]): {
  serviceRequestsMap: Map<string, ServiceRequest>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const disjointSets = new DisjointSetUnion({
    resources: serviceRequests,
    comparators: [sameResourceId, sameResourceIdentifier],
    merge: mergeServiceRequests,
  });
  const { resourceMap, refReplacementMap, danglingReferences } = disjointSets.deduplicate();

  return {
    serviceRequestsMap: resourceMap,
    refReplacementMap,
    danglingReferences,
  };
}

function mergeServiceRequests(serviceRequests: ServiceRequest[]): ServiceRequest {
  return serviceRequests[0] as ServiceRequest;
}
