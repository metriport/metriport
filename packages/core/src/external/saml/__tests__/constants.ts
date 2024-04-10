import * as uuid from "uuid";

export const iti55BodyData = {
  id: uuid.v4(),
  cxId: uuid.v4(),
  timestamp: "2024-03-03T08:44:00Z",
  gateway: {
    id: uuid.v4(),
    oid: "2.16.840.1.113883.3.9801.2.1",
    url: "http://localhost:9091/Gateway/PatientDiscovery/1_0/NhinService/NhinPatientDiscovery",
  },
  principalCareProviderIds: ["1234567890"],
  samlAttributes: {
    subjectId: "America Inc",
    subjectRole: {
      code: "106331006",
      display: "Administrative AND/OR managerial worker",
    },
    organization: "White House Medical Inc",
    organizationId: "1.16.840.1.113883.3.9621.5.219",
    homeCommunityId: "1.16.840.1.113883.3.9621.5.219",
    purposeOfUse: "TREATMENT",
  },
  patientResource: {
    resourceType: "Patient",
    id: uuid.v4(),
    name: [
      {
        family: "Obama",
        given: ["Barack"],
      },
    ],
    gender: "male",
    birthDate: "1981-01-01",
    address: [
      {
        line: ["1600 Pennsylvania Avenue NW"],
        city: "Washington",
        state: "DC",
        postalCode: "20500",
        country: "USA",
      },
    ],
  },
};

export const iti38BodyData = {
  id: uuid.v4(),
  cxId: uuid.v4(),
  timestamp: "2023-12-01T08:44:00Z",
  gateway: {
    homeCommunityId: "1.16.840.1.113883.3.9801.2.17",
    url: "http://localhost:9092/Gateway/DocumentQuery/3_0/NhinService/RespondingGateway_Query_Service/DocQuery",
  },
  externalGatewayPatient: {
    id: uuid.v4(),
    system: "2.16.840.1.113883.3.9621",
  },
  patientId: uuid.v4(),
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
  classCode: [
    {
      system: "2.16.840.1.113883.6.1",
      code: "57016-8",
    },
    {
      system: "1.3.6.1.4.1.19376.1.2.6.1",
      code: "SUMMARY",
    },
  ],
  practiceSettingCode: [
    {
      system: "1.3.6.1.4.1.21367.2017.3",
      code: "Practice-A",
    },
    {
      system: "1.3.6.1.4.1.21367.2017.3",
      code: "Practice-B",
    },
  ],
  facilityTypeCode: [
    {
      system: "2.16.840.1.113883.6.96",
      code: "22232009",
    },
    {
      system: "2.16.840.1.113883.6.96",
      code: "264372000",
    },
  ],
  serviceDate: {
    dateFrom: "2022-07-01T00:00:00.000Z",
    dateTo: "2022-07-15T00:00:00.000Z",
  },
  documentCreationDate: {
    dateFrom: "2018-01-01T00:00:00.000Z",
    dateTo: "2024-02-22T00:00:00.000Z",
  },
};

export const iti39BodyData = {
  id: uuid.v4(),
  cxId: uuid.v4(),
  gateway: {
    homeCommunityId: "3.19.840.1.113893.3.9801.2.8",
    url: "http://localhost:9093/Gateway/DocumentRetrieve/3_0/NhinService/RespondingGateway_Retrieve_Service/DocRetrieve",
  },
  timestamp: "2023-12-01T08:44:00Z",
  patientId: uuid.v4(),
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
  documentReference: [
    {
      homeCommunityId: "3.19.840.1.113893.3.9801.2.8",
      docUniqueId: uuid.v4() + ".pdf",
      repositoryUniqueId: "3.19.840.1.113893.3.9801.2.8",
      metriportId: uuid.v4(),
    },
    {
      homeCommunityId: "3.19.840.1.113893.3.9801.2.8",
      docUniqueId: uuid.v4() + ".pdf",
      repositoryUniqueId: "3.19.840.1.113893.3.9801.2.8",
      metriportId: uuid.v4(),
    },
  ],
};

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
