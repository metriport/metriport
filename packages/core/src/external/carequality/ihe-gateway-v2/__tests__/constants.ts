import { v4 as uuidv4 } from "uuid";

export const outboundXCPDRequest = {
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

export const expectedXCPDResponse = {
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

export const outboundDQRequest = {
  id: uuidv4(),
  cxId: uuidv4(),
  timestamp: "2023-12-01T08:44:00Z",
  gateway: {
    homeCommunityId: "1.16.840.1.113883.3.9801.2.17",
    url: "http://localhost:9092/Gateway/DocumentQuery/3_0/NhinService/RespondingGateway_Query_Service/DocQuery",
  },
  externalGatewayPatient: {
    id: uuidv4(),
    system: "2.16.840.1.113883.3.9621",
  },
  patientId: uuidv4(),
  samlAttributes: {
    subjectId: "Walter H.Brattain IV",
    subjectRole: {
      code: "46255001",
      display: "Pharmacist",
    },
    organization: "Family Medical Clinic",
    organizationId: "http://familymedicalclinic.org",
    homeCommunityId: "3.16.846.1.113883.3.8395",
    purposeOfUse: "TREATMENT",
  },
  classCode: {
    system: "2.16.840.1.113883.6.1",
    code: "57016-8",
  },
  practiceSettingCode: {
    system: "1.3.6.1.4.1.21367.2017.3",
    code: "Practice-A",
  },
  facilityTypeCode: {
    system: "2.16.840.1.113883.6.96",
    code: "22232009",
  },
  serviceDate: {
    dateFrom: "2022-07-01T00:00:00.000Z",
    dateTo: "2022-07-15T00:00:00.000Z",
  },
  documentCreationDate: {
    dateFrom: "2018-01-01T00:00:00.000Z",
    dateTo: "2024-02-22T00:00:00.000Z",
  },
};

export const outboundDRRequest = {
  id: "c3734e97-69ba-48e4-a102-03a5e1219fa4",
  cxId: "aeb4767b-ea11-4bbc-ba61-2274b5c9e4e9",
  gateway: {
    url: "https://carequality.particlehealth.com/services/xca-iti38",
    homeCommunityId: "2.16.840.1.113883.3.8391",
  },
  timestamp: "2023-12-01T08:44:00Z",
  patientId: "7f518b03-2ef0-4785-9f0c-dd295458df06",
  samlAttributes: {
    subjectId: "Walter H.Brattain IV",
    subjectRole: {
      code: "46255001",
      display: "Pharmacist",
    },
    organization: "Family Medical Clinic",
    organizationId: "http://familymedicalclinic.org",
    homeCommunityId: "2.16.840.1.113883.3.8391",
    purposeOfUse: "TREATMENT",
  },
  documentReference: [
    {
      size: 61030,
      title: "History of Immunization",
      creation: "2020-01-01T12:30:00",
      language: "en-US",
      contentType: "text/xml",
      docUniqueId: "2.25.9518609360022382120597398617426801793",
      homeCommunityId: "2.16.840.1.113883.3.8391",
      repositoryUniqueId: "2.16.840.1.113883.3.8391.1000.1",
    },
  ],
};
