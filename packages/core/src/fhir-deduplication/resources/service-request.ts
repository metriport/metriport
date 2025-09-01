import { ServiceRequest } from "@medplum/fhirtypes";

export function groupSameServiceRequests(serviceRequests: ServiceRequest[]): {
  serviceRequestsMap: Map<string, ServiceRequest>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const serviceRequestsMap = new Map<string, ServiceRequest>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  console.log("serviceRequests", serviceRequests);

  return {
    serviceRequestsMap,
    refReplacementMap,
    danglingReferences,
  };
}
