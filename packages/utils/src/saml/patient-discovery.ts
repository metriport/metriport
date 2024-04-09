import { startPatientDiscoveryGirth } from "@metriport/core/external/carequality/ihe-gateway-v2/xcpd/invoke-patient-discovery";
import * as dotenv from "dotenv";
dotenv.config();

const outboundRequest = {
  id: "018ea97e-7b1c-78e9-8aa1-47c7caf85afe",
  cxId: "51f45a48-ae44-432f-bd10-a3717544a5f1",
  patientId: "018ebfae-f304-742a-86a2-10150410f867",
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
        state: "Helena",
        postalCode: "Helena",
        country: "Helena",
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

async function main() {
  const response = await startPatientDiscoveryGirth({
    pdRequestGirth: outboundRequest,
    patientId: "018ebfae-f304-742a-86a2-10150410f867",
    cxId: "51f45a48-ae44-432f-bd10-a3717544a5f1",
  });
  console.log(response);
}

main();
