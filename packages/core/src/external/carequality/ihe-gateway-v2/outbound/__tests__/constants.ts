import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import {
  OutboundPatientDiscoveryReq,
  OutboundPatientDiscoveryRespSuccessfulSchema,
} from "@metriport/ihe-gateway-sdk";

export const xcpdGateway = {
  id: uuidv4(),
  oid: "2.16.840.1.113883.3.9801.2.1",
  url: "test@metriport.com",
};

export const xcaGateway = {
  id: uuidv4(),
  homeCommunityId: "2.16.840.1.113883.3.9801.2.1",
  url: "test@metriport.com",
};

export const outboundXcpdRequest: OutboundPatientDiscoveryReq = {
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
  gateways: [
    {
      url: "https://mock-metriport/soap/iti55",
      oid: "2.16.840.1.113883.3.787.0.0",
      id: "018ea97e-7b1c-78e9-8aa1-47c7caf85afe",
    },
  ],
};

export const outboundXcpdRequestMissingFields: OutboundPatientDiscoveryReq = {
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
  },
  gateways: [
    {
      url: "https://mock-metriport/soap/iti55",
      oid: "2.16.840.1.113883.3.787.0.0",
      id: "018ea97e-7b1c-78e9-8aa1-47c7caf85afe",
    },
  ],
};

export const expectedXcpdResponse: OutboundPatientDiscoveryRespSuccessfulSchema = {
  id: outboundXcpdRequest.id,
  patientId: outboundXcpdRequest.patientId,
  timestamp: outboundXcpdRequest.timestamp,
  responseTimestamp: dayjs().toISOString(),
  gatewayHomeCommunityId: outboundXcpdRequest.samlAttributes.homeCommunityId,
  gateway: {
    id: "018ea97e-7b1c-78e9-8aa1-47c7caf85afe",
    url: "https://mock-metriport/soap/iti55",
    oid: "2.16.840.1.113883.3.787.0.0",
  },
  externalGatewayPatient: {
    id: "0ODFmMmVjNGUtYzcxYy00MDkwLWJmMWMtOWQ4NTI5ZjY1YjVhLzAxOGUxMDU4LTllMWEtN2MzMy1hMmRkLTVhNzg4NGU2ZmMzOA==",
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
        postalCode: "05080",
        country: "USA",
      },
    ],
  },
  iheGatewayV2: true,
};

export const expectedMultiNameAddressResponse: OutboundPatientDiscoveryRespSuccessfulSchema = {
  ...expectedXcpdResponse,
  patientResource: {
    ...expectedXcpdResponse.patientResource,
    birthDate: expectedXcpdResponse.patientResource.birthDate,
    name: [
      ...expectedXcpdResponse.patientResource.name,
      {
        given: ["nwhinone", "bartholomew"],
        family: "nwhinzzztestpatient",
      },
      {
        given: ["NWHINONE"],
        family: "NWHINZZZTESTPATIENT",
      },
    ],
    address: [
      ...(expectedXcpdResponse.patientResource?.address ?? []),
      {
        line: ["1200 Test Street", "APT 1A"],
        city: "Helena",
        state: "AL",
        postalCode: "35080",
        country: "USA",
      },
    ],
    telecom: [
      {
        system: "MC",
        value: "tel:+1310-000-0000",
      },
      {
        system: "H",
        value: "mailto:test@test.com",
      },
    ],
    identifier: [
      {
        value: "987564321",
        system: "2.16.840.1.113883.3.9621",
      },
    ],
  },
};

export const outboundDqRequest = {
  id: uuidv4(),
  cxId: uuidv4(),
  timestamp: "2023-12-01T08:44:00Z",
  gateway: {
    homeCommunityId: "2.16.840.1.113883.3.9621",
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

export const expectedDqDocumentReference = [
  {
    homeCommunityId: "2.16.840.1.113883.3.9621",
    repositoryUniqueId: "2.16.840.1.113883.3.9621",
    docUniqueId: "123456789",
    contentType: "application/pdf",
    language: "en-US",
    size: 141255,
    title: "Continuity of Care Document",
    creation: "2024-03-27T21:43:04.878Z",
    authorInstitution: "Metriport^^^^^^^^^2.16.840.1.113883.3.9621",
  },
  {
    homeCommunityId: "2.16.840.1.113883.3.9621",
    repositoryUniqueId: "2.16.840.1.113883.3.9621",
    docUniqueId: "987654321",
    contentType: "application/pdf",
    language: "en-US",
    size: 163264,
    title: "Continuity of Care Document",
    creation: "2024-03-29T16:31:46.000Z",
    authorInstitution: "Metriport^^^^^^^^^2.16.840.1.113883.3.9621",
  },
];

export const outboundDrRequest = {
  id: "c3734e97-69ba-48e4-a102-03a5e1219fa4",
  cxId: "aeb4767b-ea11-4bbc-ba61-2274b5c9e4e9",
  gateway: {
    url: "https://carequality.test123health.com/services/xca-iti38",
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
      docUniqueId: "123456789",
      metriportId: uuidv4(),
      homeCommunityId: "2.16.840.1.113883.3.8391",
      repositoryUniqueId: "2.16.840.1.113883.3.8391.1000.1",
    },
    {
      size: 61030,
      title: "History of Immunization",
      creation: "2020-01-01T12:30:00",
      language: "en-US",
      contentType: "text/xml",
      docUniqueId: "987654321",
      metriportId: uuidv4(),
      homeCommunityId: "2.16.840.1.113883.3.8391",
      repositoryUniqueId: "2.16.840.1.113883.3.8391.1000.1",
    },
  ],
};

export const outboundDrRequestMtom = {
  id: "c3734e97-69ba-48e4-a102-03a5e1219fa4",
  cxId: "aeb4767b-ea11-4bbc-ba61-2274b5c9e4e9",
  gateway: {
    url: "https://carequality.test123health.com/services/xca-iti38",
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
      contentType: "text/xml",
      docUniqueId: "123456789",
      metriportId: uuidv4(),
      homeCommunityId: "urn:oid:987654321",
      repositoryUniqueId: "987654321",
    },
  ],
};

export const outboundDrRequestMultiMtom = {
  id: "c3734e97-69ba-48e4-a102-03a5e1219fa4",
  cxId: "aeb4767b-ea11-4bbc-ba61-2274b5c9e4e9",
  gateway: {
    url: "https://carequality.test123health.com/services/xca-iti38",
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
      contentType: "text/xml",
      docUniqueId: "1.2.840.114350.1.13.79.2.7.8.688883.556269592",
      metriportId: uuidv4(),
      homeCommunityId: "urn:oid:987654321",
      repositoryUniqueId: "987654321",
    },
    {
      contentType: "text/xml",
      docUniqueId: "1.2.840.114350.1.13.79.2.7.8.688883.556269594",
      metriportId: uuidv4(),
      homeCommunityId: "urn:oid:987654321",
      repositoryUniqueId: "987654321",
    },
  ],
};

export const testFiles = [
  { name: "test.pdf", mimeType: "application/pdf", fileExtension: ".pdf" },
  { name: "test-little-endian.tiff", mimeType: "image/tiff", fileExtension: ".tiff" },
  { name: "test-big-endian.tiff", mimeType: "image/tiff", fileExtension: ".tiff" },
  { name: "test-with-declaration.xml", mimeType: "application/xml", fileExtension: ".xml" },
  { name: "test-no-declaration.xml", mimeType: "application/xml", fileExtension: ".xml" },
  { name: "test.txt", mimeType: "text/plain", fileExtension: ".txt" },
  { name: "test.jpeg", mimeType: "image/jpeg", fileExtension: ".jpeg" },
  { name: "test.png", mimeType: "image/png", fileExtension: ".png" },
  { name: "test.bmp", mimeType: "image/bmp", fileExtension: ".bmp" },
  { name: "test.webp", mimeType: "application/octet-stream", fileExtension: ".bin" },
];

export const testFilesForUploadVerification = [
  { name: "test.pdf", mimeType: "application/pdf", fileExtension: ".pdf" },
  { name: "test-little-endian.tiff", mimeType: "image/tiff", fileExtension: ".tiff" },
  { name: "test-with-declaration.xml", mimeType: "application/xml", fileExtension: ".xml" },
  { name: "test.txt", mimeType: "text/plain", fileExtension: ".txt" },
  { name: "test.jpeg", mimeType: "image/jpeg", fileExtension: ".jpeg" },
];

export const TEST_CERT = `-----BEGIN CERTIFICATE-----
MIIBxDCCAW6gAwIBAgIQxUSXFzWJYYtOZnmmuOMKkjANBgkqhkiG9w0BAQQFADAW
MRQwEgYDVQQDEwtSb290IEFnZW5jeTAeFw0wMzA3MDgxODQ3NTlaFw0zOTEyMzEy
MzU5NTlaMB8xHTAbBgNVBAMTFFdTRTJRdWlja1N0YXJ0Q2xpZW50MIGfMA0GCSqG
SIb3DQEBAQUAA4GNADCBiQKBgQC+L6aB9x928noY4+0QBsXnxkQE4quJl7c3PUPd
Vu7k9A02hRG481XIfWhrDY5i7OEB7KGW7qFJotLLeMec/UkKUwCgv3VvJrs2nE9x
O3SSWIdNzADukYh+Cxt+FUU6tUkDeqg7dqwivOXhuOTRyOI3HqbWTbumaLdc8juf
z2LhaQIDAQABo0swSTBHBgNVHQEEQDA+gBAS5AktBh0dTwCNYSHcFmRjoRgwFjEU
MBIGA1UEAxMLUm9vdCBBZ2VuY3mCEAY3bACqAGSKEc+41KpcNfQwDQYJKoZIhvcN
AQEEBQADQQAfIbnMPVYkNNfX1tG1F+qfLhHwJdfDUZuPyRPucWF5qkh6sSdWVBY5
sT/txBnVJGziyO8DPYdu2fPMER8ajJfl
-----END CERTIFICATE-----`;

export const TEST_KEY = `-----BEGIN PRIVATE KEY-----
MIICdwIBADANBgkqhkiG9w0BAQEFAASCAmEwggJdAgEAAoGBAL4vpoH3H3byehjj
7RAGxefGRATiq4mXtzc9Q91W7uT0DTaFEbjzVch9aGsNjmLs4QHsoZbuoUmi0st4
x5z9SQpTAKC/dW8muzacT3E7dJJYh03MAO6RiH4LG34VRTq1SQN6qDt2rCK85eG4
5NHI4jceptZNu6Zot1zyO5/PYuFpAgMBAAECgYAhspeyF3M/xB7WIixy1oBiXMLY
isESFAumgfhwU2LotkVRD6rgNl1QtMe3kCNWa9pCWQcYkxeI0IzA+JmFu2shVvoR
oL7eV4VCe1Af33z24E46+cY5grxNhHt/LyCnZKcitvCcrzXExUc5n6KngX0mMKgk
W7skZDwsnKzhyUV8wQJBAN2bQMeASQVOqdfqBdFgC/NPnKY2cuDi6h659QN1l+kg
X3ywdZ7KKftJo1G9l45SN9YpkyEd9zEO6PMFaufJvZUCQQDbtAWxk0i8BT3UTNWC
T/9bUQROPcGZagwwnRFByX7gpmfkf1ImIvbWVXSpX68/IjbjSkTw1nj/Yj1NwFZ0
nxeFAkEAzPhRpXVBlPgaXkvlz7AfvY+wW4hXHyyi0YK8XdPBi25XA5SPZiylQfjt
Z6iN6qSfYqYXoPT/c0/QJR+orvVJNQJBANhRPNXljVTK2GDCseoXd/ZiI5ohxg+W
UaA/1fDvQsRQM7TQA4NXI7BO/YmSk4rW1jIeOxjiIspY4MFAIh+7UL0CQFL6zTg6
wfeMlEZzvgqwCGoLuvTnqtvyg45z7pfcrg2cHdgCXIy9kErcjwGiu6BOevEA1qTW
Rk+bv0tknWvcz/s=
-----END PRIVATE KEY-----`;
