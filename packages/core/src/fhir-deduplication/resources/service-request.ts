import { ServiceRequest } from "@medplum/fhirtypes";
import { DisjointSetUnion } from "../disjoint-set-union";
import { sameResourceId, sameResourceIdentifier } from "../comparators";

export function groupSameServiceRequests(serviceRequests: ServiceRequest[]): {
  serviceRequestsMap: Map<string, ServiceRequest>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const disjointSetUnion = new DisjointSetUnion({
    resourceType: "ServiceRequest",
    resources: serviceRequests,
    comparators: [sameResourceId, sameResourceIdentifier],
    merge: mergeServiceRequests,
  });
  const { resourceMap, refReplacementMap, danglingReferences } = disjointSetUnion.deduplicate();

  return {
    serviceRequestsMap: resourceMap,
    refReplacementMap,
    danglingReferences,
  };
}

function mergeServiceRequests(serviceRequests: ServiceRequest[]): ServiceRequest {
  return serviceRequests[0] as ServiceRequest;
}
