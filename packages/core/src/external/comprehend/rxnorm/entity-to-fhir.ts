import _ from "lodash";
import { RxNormAttributeType, RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Medication, MedicationStatement } from "@medplum/fhirtypes";
import { ComprehendConfig } from "../types";
import { getAttribute } from "./shared";
import { buildMedication } from "./medication";
import { buildDosage } from "./attribute/dosage";
import { buildDuration } from "./attribute/duration";
import { isMedicationEntity, isConfidentMatch } from "./shared";

export function getFhirResourcesFromRxNormEntities(
  entities: RxNormEntity[],
  { confidenceThreshold }: ComprehendConfig
): Array<Medication | MedicationStatement> {
  const resources: Array<Medication | MedicationStatement> = [];

  for (const entity of entities) {
    if (isMedicationEntity(entity) && isConfidentMatch(entity, confidenceThreshold)) {
      const medication = buildMedication(entity);
      if (medication) resources.push(medication);
      else continue;

      const medicationStatement = getMedicationStatement(medication, entity);
      if (medicationStatement) resources.push(medicationStatement);
    }
  }

  return resources;
}

export function getMedicationStatement(
  medication: Medication,
  entity: RxNormEntity
): MedicationStatement | undefined {
  const effectivePeriod = buildEffectivePeriod(entity);
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
    ...(effectivePeriod ? { effectivePeriod } : undefined),
  };
}

function buildEffectivePeriod(
  entity: RxNormEntity
): MedicationStatement["effectivePeriod"] | undefined {
  const duration = getAttribute(entity, RxNormAttributeType.DURATION);
  const durationValue = duration?.Text;
  if (!durationValue) return undefined;
  // TODO: parse durationValue into a Period
  return undefined;
}
