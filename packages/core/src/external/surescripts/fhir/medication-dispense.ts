import { Extension, MedicationDispense, MedicationDispensePerformer } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";

export function getMedicationDispense(detail: ResponseDetail): MedicationDispense {
  const daysSupply = getDaysSupply(detail);
  const performer = getMedicationDispensePerformer(detail);

  const fillNumber = getFillNumberAsExtension(detail);
  const extensions = [fillNumber].filter(Boolean) as Extension[];

  const medicationDispense: MedicationDispense = {
    resourceType: "MedicationDispense",
    subject: { reference: detail.patientId },
    status: "completed",
    ...(extensions.length > 0 ? { extension: extensions } : undefined),
    ...(daysSupply ? { daysSupply } : undefined),
    ...(performer.length > 0 ? { performer } : undefined),
  };

  return medicationDispense;
}

function getMedicationDispensePerformer(detail: ResponseDetail): MedicationDispensePerformer[] {
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

function getDaysSupply(detail: ResponseDetail): MedicationDispense["daysSupply"] | undefined {
  if (!detail.daysSupply) return undefined;

  const value = parseInt(detail.daysSupply);
  if (!Number.isFinite(value)) return undefined;

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
function getFillNumberAsExtension(detail: ResponseDetail): Extension | undefined {
  if (detail.fillNumber == null) return undefined;

  return {
    url: "http://hl7.org/fhir/StructureDefinition/medicationdispense-fillNumber",
    valuePositiveInt: detail.fillNumber + 1,
  };
}
