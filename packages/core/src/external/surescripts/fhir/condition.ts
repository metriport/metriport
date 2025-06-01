import { Condition } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";

export function getCondition(detail: FlatFileDetail): Condition | undefined {
  if (!detail.diagnosisICD10Code) return undefined;
  return {
    resourceType: "Condition",
    code: {
      coding: [
        {
          system: "http://hl7.org/fhir/sid/icd-10",
          code: detail.diagnosisICD10Code,
        },
      ],
    },
  };
}
