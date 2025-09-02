import { faker } from "@faker-js/faker";
import { Identifier, ServiceRequest } from "@medplum/fhirtypes";
import { ServiceRequestStatusCode } from "../../external/fhir/resources/service-request";
import { groupSameServiceRequests } from "../resources/service-request";

function makeServiceRequest({
  id,
  status,
  identifier,
}: {
  id: string;
  status: ServiceRequestStatusCode;
  identifier?: Identifier[];
}): ServiceRequest {
  return {
    resourceType: "ServiceRequest",
    id,
    status,
    ...(identifier ? { identifier } : {}),
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
    const { serviceRequestsMap } = groupSameServiceRequests([serviceRequest1, serviceRequest2]);
    expect(serviceRequestsMap.size).toBe(1);
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

    const { serviceRequestsMap } = groupSameServiceRequests([serviceRequest1, serviceRequest2]);
    expect(serviceRequestsMap.size).toBe(1);
  });
});
