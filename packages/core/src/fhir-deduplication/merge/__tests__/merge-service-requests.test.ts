import { Identifier, ServiceRequest } from "@medplum/fhirtypes";
import { ServiceRequestStatusCode } from "../../../external/fhir/resources/service-request";
import { buildServiceRequestMergeFunction } from "../resource/service-request";

function makeServiceRequest({
  id,
  status,
  identifier,
  lastUpdated,
  source,
  requisition,
}: {
  id: string;
  status: ServiceRequestStatusCode;
  requisition?: Identifier;
  identifier?: Identifier[];
  lastUpdated: string;
  source?: string;
}): ServiceRequest {
  return {
    resourceType: "ServiceRequest",
    id,
    status,
    meta: {
      lastUpdated,
      ...(source ? { source } : {}),
    },
    ...(identifier ? { identifier } : {}),
    ...(requisition ? { requisition } : {}),
  };
}

describe("Merge service requests", () => {
  const mergeServiceRequests = buildServiceRequestMergeFunction();

  it("should merge service requests", () => {
    const serviceRequest1: ServiceRequest = makeServiceRequest({
      id: "1",
      status: "unknown",
      lastUpdated: "2025-01-01T00:00:00.000Z",
      source: "service-request-1-source",
    });
    const serviceRequest2: ServiceRequest = makeServiceRequest({
      id: "2",
      status: "unknown",
      lastUpdated: "2025-01-02T00:00:00.000Z",
      source: "service-request-2-source",
    });
    const result = mergeServiceRequests([serviceRequest1, serviceRequest2]);
    expect(result).toEqual(serviceRequest2);
  });

  it("should merge service requests with identifiers", () => {
    const firstServiceRequest: ServiceRequest = makeServiceRequest({
      id: "1",
      status: "unknown",
      lastUpdated: "2025-01-01T00:00:00.000Z",
      requisition: { system: "http://another-example.com", value: "ABC123" },
      identifier: [{ system: "http://example.com", value: "1234567890" }],
      source: "service-request-1-source",
    });
    const laterServiceRequest: ServiceRequest = makeServiceRequest({
      id: "2",
      status: "unknown",
      lastUpdated: "2025-01-02T00:00:00.000Z",
      requisition: { system: "http://another-example.com", value: "ABC123" },
      identifier: [{ system: "http://example.com", value: "9876543210" }],
      source: "service-request-2-source",
    });
    const evenLaterServiceRequest: ServiceRequest = makeServiceRequest({
      id: "3",
      status: "unknown",
      lastUpdated: "2025-01-03T00:00:00.000Z",
      requisition: { system: "http://another-example.com", value: "ABC123" },
      identifier: [{ system: "http://example.com", value: "6666666666" }],
      source: "service-request-3-source",
    });

    const expectedResult: ServiceRequest = {
      ...evenLaterServiceRequest,
      identifier: [
        { system: "http://example.com", value: "1234567890" },
        { system: "http://example.com", value: "6666666666" },
        { system: "http://example.com", value: "9876543210" },
      ],
    };
    // Should be order idempotent
    const result = mergeServiceRequests([
      evenLaterServiceRequest,
      firstServiceRequest,
      laterServiceRequest,
    ]);
    expect(result).toEqual(expectedResult);

    const anotherOrderResult = mergeServiceRequests([
      firstServiceRequest,
      laterServiceRequest,
      evenLaterServiceRequest,
    ]);
    expect(anotherOrderResult).toEqual(expectedResult);

    const yetAnotherOrderResult = mergeServiceRequests([
      laterServiceRequest,
      evenLaterServiceRequest,
      firstServiceRequest,
    ]);
    expect(yetAnotherOrderResult).toEqual(expectedResult);
  });

  it("should merge service requests with different requisition identifiers", () => {
    const firstServiceRequest: ServiceRequest = makeServiceRequest({
      id: "1",
      status: "unknown",
      lastUpdated: "2025-01-01T00:00:00.000Z",
      identifier: [{ system: "http://example.com", value: "1234567890" }],
      requisition: { system: "http://example.com", value: "ABC123" },
    });

    const laterServiceRequest: ServiceRequest = makeServiceRequest({
      id: "2",
      status: "unknown",
      lastUpdated: "2025-01-02T00:00:00.000Z",
      identifier: [{ system: "http://example.com", value: "1234567890" }],
      requisition: { system: "http://another-example.com", value: "XYZ789" },
    });

    const result = mergeServiceRequests([firstServiceRequest, laterServiceRequest]);
    expect(result).toEqual(laterServiceRequest);

    const anotherOrderResult = mergeServiceRequests([laterServiceRequest, firstServiceRequest]);
    expect(anotherOrderResult).toEqual(laterServiceRequest);
  });
});
