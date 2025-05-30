import { MedicationDispense, MedicationDispensePerformer } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";

export function parseMedicationDispense(detail: FlatFileDetail): MedicationDispense {
  const daysSupply = parseDaysSupply(detail);
  const performer = parseMedicationDispensePerformer(detail);

  const medicationDispense: MedicationDispense = {
    resourceType: "MedicationDispense",
    subject: { reference: detail.patientId },
    status: "completed",
    ...(daysSupply ? { daysSupply } : null),
    ...(performer.length > 0 ? { performer } : null),
  };

  return medicationDispense;
}

function parseMedicationDispensePerformer(detail: FlatFileDetail): MedicationDispensePerformer[] {
  return [
    {
      id: "",

      actor: {
        reference: `Practitioner/${detail.prescriberNPI}`,
        display: detail.prescriberNPI,
      },
    },
  ];
}

function parseDaysSupply(detail: FlatFileDetail): MedicationDispense["daysSupply"] | null {
  if (!detail.daysSupply) return null;

  const value = parseInt(detail.daysSupply);
  if (!Number.isFinite(value)) return null;

  return {
    value,
    unit: "day",
    system: "http://unitsofmeasure.org",
    code: "d",
  };
}
