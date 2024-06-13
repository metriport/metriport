import { FamilyMemberHistory } from "@medplum/fhirtypes";
import { makeBaseDomain } from "./shared";

export function makeFamilyMemberHistory(
  params: Partial<FamilyMemberHistory> = {}
): FamilyMemberHistory {
  return {
    ...makeBaseDomain(),
    resourceType: "FamilyMemberHistory",
    status: "completed",
    date: "2018-03-19",
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
