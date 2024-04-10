import { v4 as uuidv4 } from "uuid";

export const outboundRequest = {
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
