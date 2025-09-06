import { buildDuration } from "./attribute/duration";
import { buildDosage } from "./attribute/dosage";
import { Medication } from "@medplum/fhirtypes";
import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { MedicationStatement } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import _ from "lodash";

export function buildMedicationStatement(
  medication: Medication,
  entity: RxNormEntity
): MedicationStatement | undefined {
  const medicationDosage = buildDosage(entity);
  const duration = buildDuration(entity);

  const dosage = _.compact(_.values([medicationDosage, duration]));

  return {
    resourceType: "MedicationStatement",
    id: uuidv7(),
    status: "active",
    medicationReference: {
      reference: `Medication/${medication.id}`,
    },
    ...(dosage.length > 0 ? { dosage } : undefined),
    ...(duration ? { effectivePeriod: duration } : undefined),
  };
}
