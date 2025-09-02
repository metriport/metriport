import { ServiceRequest } from "@medplum/fhirtypes";
import { DisjointSetUnion } from "../disjoint-set-union";
import { sameResourceId } from "../comparators";

export function groupSameServiceRequests(serviceRequests: ServiceRequest[]): {
  serviceRequestsMap: Map<string, ServiceRequest>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const serviceRequestsMap = new Map<string, ServiceRequest>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  const disjointSets = new DisjointSetUnion(serviceRequests);
  disjointSets.deduplicate([sameResourceId]);

  console.log("serviceRequests", serviceRequests);

  return {
    serviceRequestsMap,
    refReplacementMap,
    danglingReferences,
  };
}
