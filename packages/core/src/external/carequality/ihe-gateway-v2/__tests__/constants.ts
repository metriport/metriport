import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import {
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryRespSuccessfulSchema,
} from "@metriport/ihe-gateway-sdk";

export const outboundRequest: OutboundPatientDiscoveryReq = {
  id: uuidv4(),
  cxId: uuidv4(),
  patientId: uuidv4(),
  timestamp: "2024-04-04T19:11:55.879Z",
  principalCareProviderIds: ["1234567890"],
  samlAttributes: {
    subjectId: "America Inc",
    subjectRole: {
      code: "106331006",
      display: "Administrative AND/OR managerial worker",
    },
    organization: "White House Medical Inc",
    organizationId: "2.16.840.1.113883.3.9621.5.213",
    homeCommunityId: "2.16.840.1.113883.3.9621.5.213",
    purposeOfUse: "TREATMENT",
  },
  patientResource: {
    name: [
      {
        given: ["NWHINONE"],
        family: "NWHINZZZTESTPATIENT",
      },
    ],
    gender: "male",
    birthDate: "19810101",
    address: [
      {
        line: ["1100 Test Street"],
        city: "Helena",
        state: "AL",
        postalCode: "35080",
        country: "USA",
      },
    ],
  },
  gateways: [
    {
      url: "https://mock-metriport/soap/iti55",
      oid: "2.16.840.1.113883.3.787.0.0",
      id: "018ea97e-7b1c-78e9-8aa1-47c7caf85afe",
    },
  ],
};

export const expectedResponse: OutboundPatientDiscoveryRespSuccessfulSchema = {
  id: outboundRequest.id,
  patientId: outboundRequest.patientId,
  timestamp: outboundRequest.timestamp,
  responseTimestamp: dayjs().toISOString(),
  gatewayHomeCommunityId: outboundRequest.samlAttributes.homeCommunityId,
  gateway: {
    id: "018ea97e-7b1c-78e9-8aa1-47c7caf85afe",
    url: "https://mock-metriport/soap/iti55",
    oid: "2.16.840.1.113883.3.787.0.0",
  },
  externalGatewayPatient: {
    id: "ODFmMmVjNGUtYzcxYy00MDkwLWJmMWMtOWQ4NTI5ZjY1YjVhLzAxOGUxMDU4LTllMWEtN2MzMy1hMmRkLTVhNzg4NGU2ZmMzOA==",
    system: "2.16.840.1.113883.3.9621",
  },
  patientMatch: true,
  patientResource: {
    name: [
      {
        given: ["NWHINONE"],
        family: "NWHINZZZTESTPATIENT",
      },
    ],
    gender: "male",
    birthDate: "19810101",
    address: [
      {
        line: ["1100 Test Street"],
        city: "Helena",
        state: "AL",
        postalCode: "35080",
        country: "USA",
      },
    ],
  },
};
