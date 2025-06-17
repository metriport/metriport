import { Condition } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { ICD_10_SYSTEM } from "./constants";

export function getCondition(detail: ResponseDetail): Condition | undefined {
  if (!detail.diagnosisICD10Code) return undefined;
  return {
    resourceType: "Condition",
    code: {
      coding: [
        {
          system: ICD_10_SYSTEM,
          code: detail.diagnosisICD10Code,
        },
      ],
    },
  };
}
