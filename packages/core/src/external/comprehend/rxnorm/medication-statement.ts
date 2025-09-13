import { buildEffectivePeriod } from "./attribute/duration";
import { buildDosage } from "./attribute/dosage";
import { Medication, Patient, Reference } from "@medplum/fhirtypes";
import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { MedicationStatement } from "@medplum/fhirtypes";
import { getMedicationReference } from "./medication";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { ComprehendContext } from "../types";

export function buildMedicationStatement({
  medication,
  entity,
  context,
}: {
  medication: Medication;
  entity: RxNormEntity;
  context: ComprehendContext;
}): MedicationStatement | undefined {
  const effectivePeriod = buildEffectivePeriod(entity, context);
  const medicationReference = getMedicationReference(medication);
  const dosage = buildDosage(entity);
  const subject = getPatientReference(context);

  return {
    resourceType: "MedicationStatement",
    id: uuidv7(),
    status: "active",
    medicationReference,
    ...(subject ? { subject } : undefined),
    ...(dosage ? { dosage: [dosage] } : undefined),
    ...(effectivePeriod ? { effectivePeriod } : undefined),
  };
}

function getPatientReference(context: ComprehendContext): Reference<Patient> | undefined {
  if (context.patientId) {
    return {
      reference: `Patient/${context.patientId}`,
      id: context.patientId,
    };
  }
  return undefined;
}
