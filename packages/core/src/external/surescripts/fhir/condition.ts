import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Condition, Patient } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getSurescriptsDataSourceExtension } from "./shared";
import { ICD_10_URL } from "../../../util/constants";

export function getCondition(patient: Patient, detail: ResponseDetail): Condition | undefined {
  if (!detail.diagnosisICD10Code) return undefined;
  const subject = getPatientReference(patient);

  return {
    resourceType: "Condition",
    id: uuidv7(),
    subject,
    code: {
      coding: [
        {
          system: ICD_10_URL,
          code: detail.diagnosisICD10Code,
        },
      ],
    },
    extension: [getSurescriptsDataSourceExtension()],
  };
}
