import { RelatedPerson } from "@medplum/fhirtypes";
import { makeBaseDomain } from "./shared";

export function makeRelatedPerson(params: Partial<RelatedPerson> = {}): RelatedPerson {
  return {
    ...makeBaseDomain(),
    resourceType: "RelatedPerson",
    relationship: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/ValueSet/v3-PersonalRelationshipRoleType",
            code: "SPS",
            display: "spouse",
          },
        ],
        text: "Spouse",
      },
    ],
    telecom: [
      {
        system: "phone",
        value: "+1-111-222-3344",
        use: "mobile",
      },
    ],
    ...params,
  };
}

export const otherRelationship = {
  coding: [
    {
      system: "http://terminology.hl7.org/ValueSet/v3-PersonalRelationshipRoleType",
      code: "O",
      display: "Other",
    },
  ],
};

export const econRelationship = {
  coding: [
    {
      system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
      code: "ECON",
      display: "emergency contact",
    },
  ],
  text: "emergency contact",
};
