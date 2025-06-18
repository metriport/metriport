import {
  Extension,
  Medication,
  MedicationDispense,
  MedicationDispensePerformer,
} from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { ResponseDetail } from "../schema/response";
import { MEDICATION_DISPENSE_FILL_NUMBER_EXTENSION, UNIT_OF_MEASURE_URL } from "./constants";
import { getMedicationReference } from "./medication";
import { getPatientReference } from "./patient";
import { getPrescriberReference } from "./prescriber";
import { getResourceByNpiNumber } from "./shared";
import { SurescriptsContext } from "./types";

export function getMedicationDispense(
  context: SurescriptsContext,
  medication: Medication,
  detail: ResponseDetail
): MedicationDispense {
  const daysSupply = getDaysSupply(detail);
  const performer = getMedicationDispensePerformer(context, detail);
  const dosageInstruction = getDosageInstruction(detail);
  const subject = getPatientReference(context.patient);
  const medicationReference = getMedicationReference(medication);
  const whenHandedOver = getWhenHandedOver(detail);
  const fillNumber = getFillNumberAsExtension(detail);
  const extensions = [fillNumber].filter(Boolean) as Extension[];

  const medicationDispense: MedicationDispense = {
    resourceType: "MedicationDispense",
    id: uuidv7(),
    subject,
    medicationReference,
    status: "completed",
    ...(whenHandedOver ? { whenHandedOver } : undefined),
    ...(dosageInstruction ? { dosageInstruction } : undefined),
    ...(daysSupply ? { daysSupply } : undefined),
    ...(extensions.length > 0 ? { extension: extensions } : undefined),
    ...(performer.length > 0 ? { performer } : undefined),
  };

  return medicationDispense;
}

function getWhenHandedOver(
  detail: ResponseDetail
): MedicationDispense["whenHandedOver"] | undefined {
  if (!detail.dateWritten) return undefined;
  return detail.dateWritten.toISOString();
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
  const actor = getPrescriberReference(prescriber);

  return [
    {
      id: uuidv7(),
      actor,
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
    system: UNIT_OF_MEASURE_URL,
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
    url: MEDICATION_DISPENSE_FILL_NUMBER_EXTENSION,
    valuePositiveInt: detail.fillNumber + 1,
  };
}
