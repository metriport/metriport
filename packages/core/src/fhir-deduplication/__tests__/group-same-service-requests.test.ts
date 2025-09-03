import { faker } from "@faker-js/faker";
import { Identifier, ServiceRequest } from "@medplum/fhirtypes";
import { ServiceRequestStatusCode } from "../../external/fhir/resources/service-request";
import { deduplicateServiceRequests } from "../resources/service-request";

function makeServiceRequest({
  id,
  status,
  identifier,
  requisition,
}: {
  id: string;
  status: ServiceRequestStatusCode;
  requisition?: Identifier;
  identifier?: Identifier[];
}): ServiceRequest {
  return {
    resourceType: "ServiceRequest",
    id,
    status,
    ...(identifier ? { identifier } : {}),
    ...(requisition ? { requisition } : {}),
  };
}

describe("groupSameServiceRequests", () => {
  it("correctly groups duplicate serviceRequests based on identifiers", () => {
    const serviceRequest1 = makeServiceRequest({
      id: faker.string.uuid(),
      status: "unknown",
      identifier: [{ system: "http://example.com", value: "1234567890" }],
    });
    const serviceRequest2 = makeServiceRequest({
      id: faker.string.uuid(),
      status: "unknown",
      identifier: [{ system: "http://example.com", value: "1234567890" }],
    });
    const { combinedResources } = deduplicateServiceRequests([serviceRequest1, serviceRequest2]);
    expect(combinedResources.length).toBe(1);
  });

  it("correctly groups serviceRequests based on IDs", () => {
    const serviceRequest1 = makeServiceRequest({
      id: faker.string.uuid(),
      status: "unknown",
    });
    const serviceRequest2 = makeServiceRequest({
      id: serviceRequest1.id ?? faker.string.uuid(),
      status: "unknown",
    });

    const { combinedResources } = deduplicateServiceRequests([serviceRequest1, serviceRequest2]);
    expect(combinedResources.length).toBe(1);
  });

  it("correctly groups serviceRequests based on requisition identifiers", () => {
    const serviceRequest1 = makeServiceRequest({
      id: faker.string.uuid(),
      status: "unknown",
      requisition: { system: "http://example.com", value: "1234567890" },
    });
    const serviceRequest2 = makeServiceRequest({
      id: faker.string.uuid(),
      status: "unknown",
      requisition: { system: "http://example.com", value: "1234567890" },
    });
    const serviceRequest3 = makeServiceRequest({
      id: faker.string.uuid(),
      status: "unknown",
      requisition: { system: "http://example.com", value: "8239482342" },
    });

    const { combinedResources } = deduplicateServiceRequests([
      serviceRequest1,
      serviceRequest2,
      serviceRequest3,
    ]);
    expect(combinedResources.length).toBe(2);
  });

  it("should join multiple service requests based on multiple matching criteria", () => {
    // Matches based on requisition identifier
    const serviceRequest1 = makeServiceRequest({
      id: faker.string.uuid(),
      status: "unknown",
      requisition: { system: "http://example.com", value: "1234567890" },
    });
    const serviceRequest2 = makeServiceRequest({
      id: faker.string.uuid(),
      status: "unknown",
      identifier: [{ system: "http://another-example.com", value: "6666666666" }],
      requisition: { system: "http://example.com", value: "1234567890" },
    });
    // Matches based on identifier
    const serviceRequest3 = makeServiceRequest({
      id: faker.string.uuid(),
      status: "unknown",
      identifier: [{ system: "http://another-example.com", value: "6666666666" }],
    });
    // Not duplicate of any other service request
    const serviceRequest4 = makeServiceRequest({
      id: faker.string.uuid(),
      status: "unknown",
      identifier: [{ system: "http://another-example.com", value: "132412341234" }],
      requisition: { system: "http://example.com", value: "938982983" },
    });

    const { combinedResources } = deduplicateServiceRequests([
      serviceRequest1,
      serviceRequest2,
      serviceRequest3,
      serviceRequest4,
    ]);
    expect(combinedResources.length).toBe(2);
  });
});
