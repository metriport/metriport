// TODO: #1350 - Write integration tests for patient discovery on CQ go live
import {
  PatientDiscoveryRequest,
  patientDiscoveryResponseSchema,
} from "@metriport/ihe-gateway-sdk";
import { createPatientDiscoveryResult } from "./command/patient-discovery-result/create-patient-discovery-result";
import { PATIENT_DISCOVERY_TIMEOUT } from "./patient";

export async function mockLongExecution(patientDiscoveryRequest: PatientDiscoveryRequest) {
  await mockResult(
    patientDiscoveryRequest.id,
    patientDiscoveryRequest.cxId,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    patientDiscoveryRequest.patientResource.id!
  );
  await mockResult(
    patientDiscoveryRequest.id,
    patientDiscoveryRequest.cxId,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    patientDiscoveryRequest.patientResource.id!
  );
  return new Promise(resolve => {
    setTimeout(() => {
      resolve("mockResult");
    }, PATIENT_DISCOVERY_TIMEOUT.asMilliseconds() * 2);
  });
}

export async function mockResult(id: string, cxId: string, patientId: string) {
  const randInt = Math.floor(Math.random() * 3);
  const body = {
    id,
    cxId,
    timestamp: new Date().toISOString(),
    responseTimestamp: "2023-11-29T08:41:47.047-0800",
    patientId,
    patientMatch: true,
    xcpdHomeCommunityId: "2.16.840.1.113883.3.9621",
    xcpdPatientId: {
      id: "EV12ZGR7J6K4MF8",
      system: "2.16.840.1.113883.3.9621",
    },
    gateway: {
      oid: `2.16.840.1.113883.3.564.${randInt}`,
      url: "https://sfd-np.et0121.epichosted.com:14430/interconnect-ce-env1/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
    },
    patientResource: {
      resourceType: "Patient",
      id: patientId,
      identifier: [
        {
          system: "urn:oid:2.16.840.1.113883.4.1",
          value: "666-10-0001",
        },
      ],
      name: [
        {
          family: "NWHINZZZTESTPATIENT",
          given: ["NWHINONE"],
        },
      ],
    },
  };
  const patientDiscovery = patientDiscoveryResponseSchema.parse(body);
  await createPatientDiscoveryResult(patientDiscovery);
}
