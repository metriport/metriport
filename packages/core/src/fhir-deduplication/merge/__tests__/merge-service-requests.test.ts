import { ServiceRequest } from "@medplum/fhirtypes";
import { buildServiceRequestMergeFunction } from "../resource/service-request";

describe("Merge service requests", () => {
  const mergeServiceRequests = buildServiceRequestMergeFunction();

  it("should merge service requests", () => {
    const serviceRequest1: ServiceRequest = {
      resourceType: "ServiceRequest",
      meta: {
        lastUpdated: "2025-01-01T00:00:00.000Z",
        source: "service-request-1-source",
      },
      id: "1",
    };
    const serviceRequest2: ServiceRequest = {
      resourceType: "ServiceRequest",
      meta: {
        lastUpdated: "2025-01-02T00:00:00.000Z",
        source: "service-request-2-source",
      },
      id: "2",
    };
    const result = mergeServiceRequests([serviceRequest1, serviceRequest2]);
    expect(result).toEqual(serviceRequest2);
  });
});
