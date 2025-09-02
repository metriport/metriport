import { MetriportError } from "@metriport/shared";
import { ServiceRequest } from "@medplum/fhirtypes";
import { DisjointSetUnion } from "../disjoint-set-union";
import { sameResourceId, sameResourceIdentifier } from "../comparators";
import { compareServiceRequestsByStatus } from "../../external/fhir/resources/service-request";
import { mergeIntoTargetResource } from "../shared";

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
  serviceRequests.sort(compareServiceRequestsByStatus);
  const masterServiceRequest = serviceRequests[serviceRequests.length - 1];
  if (!masterServiceRequest) {
    throw new MetriportError("merge must always be called with at least one resource");
  }

  for (let i = 0; i < serviceRequests.length - 1; i++) {
    const serviceRequest = serviceRequests[i];
    if (!serviceRequest) continue;
    mergeIntoTargetResource(masterServiceRequest, serviceRequest);
  }
  return masterServiceRequest;
}
