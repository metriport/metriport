import {
  Demographics,
  DocumentReference,
  Patient,
  PatientCollectionItem,
  PatientProbableLinkItem,
} from "@metriport/commonwell-sdk";
import { AddressUseCodes } from "@metriport/commonwell-sdk/models/address";
import { GenderCodes } from "@metriport/commonwell-sdk/models/demographics";
import { NameUseCodes } from "@metriport/commonwell-sdk/models/human-name";
import { uuidv7 } from "@metriport/core/util/uuid-v7";

export const cwURL = "https://api.integration.commonwellalliance.lkopera.com";
export const orgRoute = "v1/org";

export function createPatient(
  localOrgOID: string,
  localOrgName: string,
  patientId: string,
  demographics?: Partial<Demographics>
): Patient {
  return {
    identifier: [
      {
        value: patientId,
        system: `urn:oid:${localOrgOID}`,
        use: "usual",
        assigner: localOrgName,
      },
    ],
    name: [
      {
        given: demographics?.name?.[0]?.given ?? ["John"],
        family: demographics?.name?.[0]?.family ?? ["Doe"],
        use: NameUseCodes.usual,
      },
    ],
    gender: demographics?.gender ?? GenderCodes.M,
    birthDate: demographics?.birthDate ?? "1950-01-01",
    address: [
      {
        line: demographics?.address?.[0]?.line ?? ["123 Main St"],
        city: demographics?.address?.[0]?.city ?? "Miami",
        state: demographics?.address?.[0]?.state ?? "FL",
        postalCode: demographics?.address?.[0]?.postalCode ?? "12345",
        country: demographics?.address?.[0]?.country ?? "USA",
        use: demographics?.address?.[0]?.use ?? AddressUseCodes.home,
      },
    ],
    active: true,
  };
}

export function createPatientCollectionItem(
  localOrgOID: string,
  localOrgName: string,
  patientId: string,
  demographics?: Partial<Demographics>
): PatientCollectionItem {
  return {
    Patient: createPatient(localOrgOID, localOrgName, patientId, demographics),
    Links: {
      Self: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgOID}/patient/${patientId}`,
      PatientLink: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgOID}/patient/${patientId}/links`,
      Delete: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgOID}/patient/${patientId}`,
    },
  };
}

export function createProbablePatient(
  localOrgOID: string,
  localOrgName: string,
  patientId: string,
  demographics?: Partial<Demographics>
): PatientProbableLinkItem {
  return {
    Patient: createPatient(localOrgOID, localOrgName, patientId, demographics),
    Links: {
      Self: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgOID}/patient/${patientId}`,
      Link: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgOID}/patient/${patientId}/link`,
      Unlink: `${cwURL}/${orgRoute}/urn%3aoid%3a${localOrgOID}/patient/${patientId}/unlink`,
    },
  };
}

export function createPatientLink(patientLink: string, patientId: string, orgId: string) {
  return {
    Patients: [
      {
        Patient: {
          identifier: [
            {
              value: patientId,
              system: `urn:oid:${orgId}`,
              use: "usual",
              assigner: "Test Organization",
            },
          ],
          name: [
            {
              given: ["John"],
              family: ["Doe"],
              use: "usual",
            },
          ],
          gender: "male",
          birthDate: "1950-01-01",
          address: [
            {
              line: ["123 Main St"],
              city: "Miami",
              state: "FL",
              postalCode: "12345",
              country: "USA",
              use: "home",
            },
          ],
          active: true,
        },
        Links: {
          Self: `${cwURL}/${orgRoute}/${orgId}/patient/${patientId}`,
          PatientLink: `${patientLink}/${patientId}/`,
          ResetLink: `${patientLink}/${patientId}/Reset`,
          Delete: `${cwURL}/${orgRoute}/${orgId}/patient/${patientId}`,
        },
      },
    ],
    status: {
      message: "Success",
      code: 200,
    },
  };
}

export function createDocument(orgId: string, orgName: string): DocumentReference {
  return {
    resourceType: "DocumentReference",
    contained: [
      {
        resourceType: "Organization",
        id: "orgRef1",
        name: orgName,
      },
      {
        resourceType: "Practitioner",
        id: "authRef1",
        organization: {
          reference: "#orgRef1",
        },
      },
      {
        resourceType: "Patient",
        id: "patRef1",
        identifier: [
          {
            system: "urn:oid:https://github.com/synthetichealth/synthea",
            value: "e48c330b-d0d9-4bbd-9811-9c63cde19c7e",
          },
          {
            system: "urn:oid:1.2.3.4.5.6.7.8.9Test Org2",
            value: uuidv7(),
          },
        ],
        name: [
          {
            family: ["Doe"],
            given: ["John"],
          },
        ],
        gender: {
          coding: [
            {
              system: "http://hl7.org/implement/standards/fhir/valueset-administrative-gender.html",
              code: "M",
            },
          ],
        },
        birthDate: "1975-05-05",
        address: [
          {
            line: ["Brasil St"],
            city: "Brasil",
            state: "California",
            zip: "12345",
            country: "USA",
          },
        ],
      },
    ],
    masterIdentifier: {
      system: "urn:ietf:rfc:1234",
      value: `${orgId}`,
    },
    identifier: [
      {
        use: "official",
        system: "urn:ietf:rfc:1234",
        value: `urn:uuid:${orgId}`,
      },
    ],
    subject: {
      reference: "#patRef1",
    },
    type: {
      coding: [
        {
          system: "http://loinc.org/",
          code: "1234-1",
          display: "HIV 1 and 2 tests - Meaningful Use set",
        },
      ],
    },
    status: "current",
    description: "Summarization Of Episode Notes - provided by Metriport",
    content: [
      {
        attachment: {
          contentType: "application/pdf",
          url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        },
      },
    ],
    context: {
      event: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "62479008",
            display: "AIDS",
          },
        ],
      },
      period: {
        start: "2022-10-05T22:00:00Z",
        end: "2022-10-05T23:00:00Z",
      },
    },
  };
}
