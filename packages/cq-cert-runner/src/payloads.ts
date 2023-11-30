import { XCPDPayload } from "@metriport/ihe-gateway-sdk";

export const patients: XCPDPayload[] = [
  {
    requestId: "4d7acacd-7249-4f59-bf27-9adccb6141ee",
    cxId: "aeb4767b-ea11-4bbc-ba61-2274b5c9e4e9",
    xcpdGateways: [
      {
        id: "2e304916-539f-4a0e-8c13-07347b38609a",
        oid: "2.16.840.1.113883.3.564.1",
        url: "https://sfd-np.et0121.epichosted.com:14430/interconnect-ce-env1/wcf/epic.community.hie/xcpdrespondinggatewaysync.svc/ceq",
      },
      {
        id: "41a4c064-11b9-472d-9ea8-36a89f7aa0ee",
        oid: "2.16.840.1.113883.3.9801.2.1",
        url: "https://iheapitest.innovarhealthcare.com/services/XCPD/RespondingGatewayService",
      },
    ],
    principalCareProviderNPIs: ["1689055451", "1689055467"],
    patient: {
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
  },
];
