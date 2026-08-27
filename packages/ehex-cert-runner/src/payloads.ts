import {
  DocumentReference,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
  OutboundPatientDiscoveryReq,
  PatientResource,
  XCAGateway,
  XCPDGateway,
} from "@metriport/ihe-gateway-sdk";
import { uuidv4 } from "@metriport/shared/util";
import dayjs from "dayjs";

export const generatePatientDiscoveryRequest = ({
  xcpdGateways,
  cxId,
  patientId,
  orgOid,
  orgName,
}: {
  xcpdGateways: XCPDGateway[];
  cxId: string;
  patientId: string;
  orgOid: string;
  orgName: string;
}): OutboundPatientDiscoveryReq => {
  const user = `${orgName} System User`;

  return {
    id: uuidv4(),
    cxId,
    patientId,
    gateways: xcpdGateways,
    timestamp: dayjs().toISOString(),
    samlAttributes: {
      subjectId: user,
      subjectRole: {
        code: "106331006",
        display: "Administrative AND/OR managerial worker",
        system: "urn:oid:2.16.840.1.113883.6.96",
      },
      organization: orgName,
      organizationId: orgOid,
      homeCommunityId: orgOid,
      purposeOfUse: "TREATMENT",
    },
    principalCareProviderIds: ["124567893"],
    patientResource: makePatientAmy(patientId),
    // patientResource: makePatientRobert(patientId),
  };
};

export function makePatientAmy(patientId: string): PatientResource {
  return {
    resourceType: "Patient",
    id: patientId,
    name: [
      {
        family: "Davidson",
        given: ["Amy", "C"],
      },
    ],
    telecom: [
      {
        system: "HP",
        value: "tel:+1-417-989-0987",
      },
      {
        system: "WP",
        value: "tel:+1-417-989-3300",
      },
    ],
    gender: "female",
    birthDate: "1983-10-17",
    address: [
      {
        line: ["809 First Ave"],
        city: "Springfield",
        state: "MO",
        postalCode: "65801",
        country: "USA",
      },
    ],
  };
}

export function makePatientRobert(patientId: string): PatientResource {
  return {
    resourceType: "Patient",
    id: patientId,
    name: [
      {
        family: "Carson",
        given: ["Robert", "M"],
      },
    ],
    telecom: [
      {
        system: "HP",
        value: "tel:+1-303-454-0909",
      },
      {
        system: "WP",
        value: "tel:+1-303-454-0111",
      },
    ],
    gender: "male",
    birthDate: "1960-02-10",
    address: [
      {
        line: ["290 Jackson Lane"],
        city: "Boulder",
        state: "CO",
        postalCode: "80301",
        country: "USA",
      },
    ],
  };
}

export const generateDocumentQueryRequest = ({
  xcaGateway,
  patientId,
  externalPatientId,
  homeCommunityId,
  orgOid,
  orgName,
}: {
  xcaGateway: XCAGateway;
  patientId: string;
  externalPatientId: string;
  homeCommunityId: string;
  orgOid: string;
  orgName: string;
}): OutboundDocumentQueryReq => {
  const user = `${orgName} System User`;
  return {
    id: uuidv4(),
    cxId: uuidv4(),
    patientId,
    gateway: xcaGateway,
    timestamp: dayjs().toISOString(),
    samlAttributes: {
      subjectId: user,
      subjectRole: {
        code: "106331006",
        display: "Administrative AND/OR managerial worker",
        system: "urn:oid:2.16.840.1.113883.6.96",
      },
      organization: orgName,
      organizationId: orgOid,
      homeCommunityId,
      purposeOfUse: "TREATMENT",
    },
    externalGatewayPatient: {
      id: externalPatientId,
      system: xcaGateway.homeCommunityId,
    },
  };
};

export const generateDocumentRetrievalRequest = ({
  patientId,
  xcaGateway,
  orgOid,
  homeCommunityId,
  orgName,
  externalPatientId,
  externalDocumentId,
  repositoryUniqueId,
}: {
  patientId: string;
  xcaGateway: XCAGateway;
  orgOid: string;
  homeCommunityId: string;
  orgName: string;
  externalPatientId: string;
  externalDocumentId: string;
  repositoryUniqueId: string;
}): OutboundDocumentRetrievalReq => {
  const externalGatewayHomeCommunityId = xcaGateway.actualHomeCommunityId;
  if (!externalGatewayHomeCommunityId) {
    throw new Error("External gateway home community ID is required");
  }
  const user = `${orgName} System User`;
  return {
    id: uuidv4(),
    cxId: uuidv4(),
    patientId,
    externalPatientId,
    gateway: xcaGateway,
    timestamp: dayjs().toISOString(),
    samlAttributes: {
      subjectId: user,
      subjectRole: {
        code: "106331006",
        display: "Administrative AND/OR managerial worker",
        system: "urn:oid:2.16.840.1.113883.6.96",
      },
      organization: orgName,
      organizationId: orgOid,
      homeCommunityId,
      purposeOfUse: "TREATMENT",
    },
    documentReference: [
      getDefaultDocRef(externalDocumentId, externalGatewayHomeCommunityId, repositoryUniqueId),
    ],
  };
};

function getDefaultDocRef(
  externalDocumentId: string,
  homeCommunityId: string,
  repositoryUniqueId: string
): DocumentReference {
  return {
    homeCommunityId,
    repositoryUniqueId,
    metriportId: uuidv4(),
    docUniqueId: externalDocumentId,
    contentType: "application/xml",
    language: "en-us",
    size: 237594,
    title: "XDSDocumentEntry.classCode",
    creation: "2021-04-01T00:00:00.000Z",
    serviceStartTime: "2021-04-01T08:00:00.000Z",
    serviceStopTime: "2021-04-01T09:00:00.000Z",
    authorPerson: "^Smitty^Gerald^^^",
    authorInstitution: "Cleveland Clinic",
    classCoding: {
      system: "http://loinc.org",
      code: "34133-9",
      display: "XDSDocumentEntry.classCode",
    },
    typeCoding: {
      system: "http://loinc.org",
      code: "57016-8",
      display: "Consent Document",
    },
    formatCoding: {
      system: "urn:oid:1.3.6.1.4.1.19376.1.2.3",
      code: "urn:ihe:iti:bppc:2007",
      display: "urn:ihe:iti:bppc:2007",
    },
    confidentialityCoding: {
      system: "urn:oid:2.16.840.1.113883.5.25",
      code: "R",
      display: "Restricted",
    },
    practiceSettingCoding: {
      system: "http://snomed.info/sct",
      code: "Practice-D",
      display: "Pathology",
    },
    healthcareFacilityTypeCoding: {
      system: "http://snomed.info/sct",
      code: "66280005",
      display: "Private home-based care",
    },
  };
}
