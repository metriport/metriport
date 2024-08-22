import { faker } from "@faker-js/faker";
import { Encounter, Location, Practitioner } from "@medplum/fhirtypes";
import { makeSubjectReference } from "./shared";

export function makePractitioner(params: Partial<Practitioner>): Practitioner {
  return {
    resourceType: "Practitioner",
    ...params,
  };
}

export function makeLocation(params: Partial<Location>): Location {
  return {
    resourceType: "Location",
    ...params,
  };
}

export function makeEncounter(
  params: Partial<Encounter> = {},
  ids?: { enc?: string; pract?: string; loc?: string }
): Encounter {
  return {
    ...makeSubjectReference(),
    id: ids?.enc ?? faker.string.uuid(),
    resourceType: "Encounter",
    participant: [
      { individual: { reference: `Practitioner/${ids?.pract ?? faker.string.uuid()}` } },
    ],
    location: [{ location: { reference: `Location/${ids?.loc ?? faker.string.uuid()}` } }],
    ...params,
  };
}

export const exampleType = [
  {
    coding: [
      {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
      },
    ],
  },
];

export const exampleType2 = [
  {
    coding: [
      {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "EMER",
      },
    ],
  },
];

export const exampleHospitalization = {
  dischargeDisposition: {
    coding: [
      {
        system: "urn:oid:2.16.840.1.113883.6.301.5",
        code: "02",
        display: "Discharged/transferred to a Short-Term General Hospital for Inpatient Care",
      },
    ],
  },
};

export const exampleHospitalization2 = {
  dischargeDisposition: {
    coding: [
      {
        system: "urn:oid:2.16.840.1.113883.6.301.5",
        code: "04",
        display: "Transferred to Short-Term General Hospital for Inpatient Care",
      },
    ],
  },
};

export const exampleReasonCode = [
  {
    coding: [
      {
        system: "http://snomed.info/sct",
        code: "52254009",
      },
    ],
  },
];
export const exampleReasonCode2 = [
  {
    coding: [
      {
        system: "http://snomed.info/sct",
        code: "123456789",
      },
    ],
  },
];

export const exampleDiagnosis = [
  {
    condition: {
      reference: "Condition/some-condition-ID",
    },
  },
];
export const exampleDiagnosis2 = [
  {
    condition: {
      reference: "Condition/some-other-condition-ID",
    },
  },
];
