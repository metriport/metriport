import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { Medication, CodeableConcept } from "@medplum/fhirtypes";
import { getRxNormCode } from "./shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { RXNORM_URL } from "@metriport/shared/medical";

export function buildMedication(entity: RxNormEntity): Medication | undefined {
  const code = buildMedicationCode(entity);
  if (!code) return undefined;

  const medication: Medication = {
    resourceType: "Medication",
    id: uuidv7(),
    status: "active",
    code,
  };

  return medication;
}

function buildMedicationCode(entity: RxNormEntity): CodeableConcept | undefined {
  const code = getRxNormCode(entity);
  if (!code) return undefined;

  const display = entity.Text;
  if (!display) return undefined;

  return {
    coding: [{ system: RXNORM_URL, code, display }],
  };
}
