import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Condition } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { SurescriptsContext } from "./types";
import { getPatientReference } from "./patient";
import { ICD_10_SYSTEM } from "./constants";

export function getCondition(
  context: SurescriptsContext,
  detail: ResponseDetail
): Condition | undefined {
  if (!detail.diagnosisICD10Code) return undefined;

  const subject = getPatientReference(context.patient);
  return {
    resourceType: "Condition",
    id: uuidv7(),
    ...(subject ? { subject } : undefined),
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
