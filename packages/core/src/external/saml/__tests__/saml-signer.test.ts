import * as uuid from "uuid";
import { createITI5SoapEnvelope } from "../xcpd/iti55-envelope";
import { createITI38SoapEnvelope } from "../xca/iti38-envelope";
import { createITI39SoapEnvelope } from "../xca/iti39-envelope";
import { verifySaml } from "../security/verify";
import { signTimestamp, signEnvelope } from "../security/sign";
import { getEnvVarOrFail } from "../../../util/env-var";

import * as dotenv from "dotenv";
dotenv.config();

const iti55BodyData = {
  id: uuid.v4(),
  cxId: uuid.v4(),
  timestamp: "2024-03-03T08:44:00Z",
  gateways: [
    {
      id: uuid.v4(),
      oid: "2.16.840.1.113883.3.9801.2.1",
      url: "http://localhost:9091/Gateway/PatientDiscovery/1_0/NhinService/NhinPatientDiscovery",
    },
  ],
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

const iti38BodyData = {
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

const iti39BodyData = {
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

const privateKey = getEnvVarOrFail("IHE_STAGING_KEY");
const publicCert = getEnvVarOrFail("IHE_STAGING_CERT");

describe("Basic SAML Signature Verification", () => {
  it("should sign and verify the XCPD SOAP envelope successfully", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: publicCert,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: publicCert })).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: publicCert })).toBeTruthy();
  });

  it("should sign and verify the ITI38 envelope successfully", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: iti38BodyData,
      publicCert: publicCert,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: publicCert })).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: publicCert })).toBeTruthy();
  });

  it("should sign and verify the ITI39 envelope successfully", () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: iti39BodyData,
      publicCert: publicCert,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: publicCert })).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: publicCert })).toBeTruthy();
  });
});

describe("Intermediate Certs SAML Signature Verification", () => {
  it("should sign and verify the XCPD SOAP envelope successfully", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: publicCert,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: publicCert })).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: publicCert })).toBeTruthy();
  });
});
