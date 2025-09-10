import { ServiceRequest } from "@medplum/fhirtypes";
import { DisjointSetUnion } from "../disjoint-set-union";
import { sameResourceIdentifier } from "../comparators";
import { DeduplicationResult } from "../shared";
import { buildServiceRequestMergeFunction } from "../merge/resource/service-request";

export function deduplicateServiceRequests(
  serviceRequests: ServiceRequest[]
): DeduplicationResult<ServiceRequest> {
  const dsu = new DisjointSetUnion({
    resourceType: "ServiceRequest",
    resources: serviceRequests,
    hashKeyGenerators: [requisitionIdentifierHashKey],
    comparators: [sameResourceIdentifier],
    merge: buildServiceRequestMergeFunction(),
  });

  return dsu.deduplicate();
}

function requisitionIdentifierHashKey(serviceRequest: ServiceRequest): string | undefined {
  const requisitionIdentifier = serviceRequest.requisition;
  if (!requisitionIdentifier) return undefined;
  return JSON.stringify(requisitionIdentifier);
}
