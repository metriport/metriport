import {
  Extension,
  Medication,
  MedicationDispense,
  MedicationDispensePerformer,
} from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { ResponseDetail } from "../schema/response";
import { getMedicationReference } from "./medication";
import { getResourceByNpiNumber } from "./shared";
import { SurescriptsContext } from "./types";

export function getMedicationDispense(
  context: SurescriptsContext,
  medication: Medication,
  detail: ResponseDetail
): MedicationDispense {
  const daysSupply = getDaysSupply(detail);
  const performer = getMedicationDispensePerformer(context, detail);
  const fillNumber = getFillNumberAsExtension(detail);
  const dosageInstruction = getDosageInstruction(detail);
  const extensions = [fillNumber].filter(Boolean) as Extension[];

  const medicationDispense: MedicationDispense = {
    resourceType: "MedicationDispense",
    subject: {
      reference: `Patient/${detail.patientId}`,
      display: context.patient.name?.[0]?.text ?? "",
    },
    medicationReference: getMedicationReference(medication),
    status: "completed",
    ...(dosageInstruction ? { dosageInstruction } : undefined),
    ...(daysSupply ? { daysSupply } : undefined),
    ...(extensions.length > 0 ? { extension: extensions } : undefined),
    ...(performer.length > 0 ? { performer } : undefined),
  };

  return medicationDispense;
}

function getDosageInstruction(
  detail: ResponseDetail
): MedicationDispense["dosageInstruction"] | undefined {
  if (!detail.directions) return undefined;
  return [
    {
      text: detail.directions,
    },
  ];
}

function getMedicationDispensePerformer(
  context: SurescriptsContext,
  detail: ResponseDetail
): MedicationDispensePerformer[] {
  if (!detail.prescriberNpiNumber) return [];
  const prescriber = getResourceByNpiNumber(context.practitioner, detail.prescriberNpiNumber);
  if (!prescriber) return [];

  return [
    {
      id: uuidv7(),
      actor: {
        reference: `Practitioner/${prescriber.id}`,
        display: prescriber.name?.[0]?.text ?? "",
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
