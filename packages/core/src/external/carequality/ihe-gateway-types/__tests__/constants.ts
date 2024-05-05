export const testInboundXCPD = {
  id: "1234",
  timestamp: "2024-02-29T07:16:49",
  samlAttributes: {
    subjectId: "Pharmacist",
    subjectRole: {
      code: "46255001",
      display: "Pharmacist",
    },
    organization: "Family Medical Clinic",
    organizationId: "2.16.840.1.113883.3.8391",
    homeCommunityId: "urn:oid:2.16.840.1.113883.3.8391",
    purposeOfUse: "TREATMENT",
  },
  patientResource: {
    resourceType: "Patient",
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

export const testInboundDQ = {
  id: "f1a2b3c4-d5e6-f7g8-h9i0-j1k2l3m4n5o6",
  timestamp: "2024-05-03T07:25:52",
  samlAttributes: {
    subjectId: "Doe, John",
    subjectRole: {
      code: "000000000",
      display: "HEALTHCARE WORKER",
    },
    organization: "Generic Medical Center",
    organizationId: "9.8.765.4321.1.23.456.7.8.9.1011.12",
    homeCommunityId: "9.8.765.4321.1.23.456.7.8.9.1011.12",
    purposeOfUse: "HEALTHCARE OPERATIONS",
  },
  externalGatewayPatient: {
    id: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
    system: "9.8.765.4321.1.23.456",
  },
  entryStatus: ["urnoasinametcebxml-regrepStatusTypeApproved"],
  entryType: ["Stable", "On-Demand"],
  entryClassCode: [
    {
      code: "00000-0",
      system: "9.8.765.4321.1.23",
    },
    {
      code: "11111-1",
      system: "9.8.765.4321.1.23",
    },
  ],
};

export const testInboundDR = {
  id: "m1n2o3p4-q5r6-s7t8-u9v0-w1x2y3z4a5b6",
  timestamp: "2024-04-18T12:12:46",
  samlAttributes: {
    subjectId: "Smith, Jane",
    subjectRole: {
      code: "000000000",
      display: "HEALTHCARE WORKER",
    },
    organization: "Generic Hospital",
    organizationId: "1.2.345.6789.1.23.456.7.8.9.1011.12",
    homeCommunityId: "1.2.345.6789.1.23.456.7.8.9.1011.12",
    purposeOfUse: "HEALTHCARE OPERATIONS",
  },
  documentReference: [
    {
      homeCommunityId: "urnoid9.8.765.4321.1.23",
      repositoryUniqueId: "9.8.765.4321.1.23",
      docUniqueId:
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0",
    },
  ],
};
