import { FamilyMemberHistory } from "@medplum/fhirtypes";
import { makeBaseDomain } from "./shared";

export function makeFamilyMemberHistory(
  params: Partial<FamilyMemberHistory> = {}
): FamilyMemberHistory {
  return {
    ...makeBaseDomain(),
    resourceType: "FamilyMemberHistory",
    status: "completed",
    relationship: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
          code: "FTH",
          display: "father",
        },
      ],
    },
    bornDate: "1930-01-01",
    name: "Sven",
    deceasedBoolean: true,
    sex: {
      coding: [
        {
          system: "http://hl7.org/fhir/administrative-gender",
          code: "male",
          display: "Male",
        },
      ],
    },
    ...params,
  };
}

export const motherFamilyMemberHistory: Partial<FamilyMemberHistory> = {
  name: "Helga",
  relationship: {
    coding: [
      {
        system: "http://snomed.info/sct",
        code: "72705000",
        display: "Mother",
      },
    ],
  },
  sex: {
    coding: [
      {
        system: "http://hl7.org/fhir/administrative-gender",
        code: "female",
        display: "Female",
      },
    ],
  },
};
