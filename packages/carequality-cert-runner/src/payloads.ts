import { XCPDGateways, PatientDiscoveryRequestOutgoing } from "@metriport/ihe-gateway-sdk";

export const generatePatient = (
  xcpdGateways: XCPDGateways,
  orgOid: string,
  orgName: string
): PatientDiscoveryRequestOutgoing => {
  const user = `${orgName} System User`;

  return {
    id: "abcd1234",
    cxId: "abc123",
    gateways: xcpdGateways,
    timestamp: "2021-05-04T19:32:00.000Z",
    samlAttributes: {
      subjectId: user,
      subjectRole: {
        code: "106331006",
        display: "Administrative AND/OR managerial worker",
      },
      organization: orgName,
      organizationId: orgOid,
      homeCommunityId: orgOid,
      purposeOfUse: "TREATMENT",
    },
    principalCareProviderIds: ["124567893"],
    patientResource: {
      resourceType: "Patient",
      id: "666-10-0001",
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
      telecom: [
        {
          system: "phone",
          value: "205-111-1111",
        },
      ],
      gender: "male",
      birthDate: "1981-01-01",
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
};
