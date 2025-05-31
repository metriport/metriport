import { Extension, MedicationDispense, MedicationDispensePerformer } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";

export function getMedicationDispense(detail: FlatFileDetail): MedicationDispense {
  const daysSupply = getDaysSupply(detail);
  const performer = getMedicationDispensePerformer(detail);

  const fillNumber = getFillNumberAsExtension(detail);
  const extensions = [fillNumber].filter(Boolean) as Extension[];

  const medicationDispense: MedicationDispense = {
    resourceType: "MedicationDispense",
    subject: { reference: detail.patientId },
    status: "completed",
    ...(extensions.length > 0 ? { extension: extensions } : null),
    ...(daysSupply ? { daysSupply } : null),
    ...(performer.length > 0 ? { performer } : null),
  };

  return medicationDispense;
}

function getMedicationDispensePerformer(detail: FlatFileDetail): MedicationDispensePerformer[] {
  return [
    {
      id: "",

      actor: {
        reference: `Practitioner/${detail.prescriberNPI}`,
        display: detail.prescriberName,
      },
    },
  ];
}

function getDaysSupply(detail: FlatFileDetail): MedicationDispense["daysSupply"] | null {
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

/**
 * Surescripts zero-indexes the fill number, so we need to add 1 to meet the FHIR specification.
 * https://build.fhir.org/medicationdispense-definitions.html#MedicationDispense.fillNumber
 */
function getFillNumberAsExtension(detail: FlatFileDetail): Extension | undefined {
  if (detail.fillNumber == null) return undefined;

  return {
    url: "http://hl7.org/fhir/StructureDefinition/medicationdispense-fillNumber",
    valuePositiveInt: detail.fillNumber + 1,
  };
}
