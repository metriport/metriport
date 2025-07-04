import {
  Extension,
  Medication,
  MedicationDispense,
  MedicationDispensePerformer,
} from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { buildDayjs } from "@metriport/shared/common/date";
import { ResponseDetail } from "../schema/response";
import { MEDICATION_DISPENSE_FILL_NUMBER_EXTENSION, UNIT_OF_MEASURE_URL } from "./constants";
import { getMedicationReference } from "./medication";
import { getPatientReference } from "./patient";
import { getPrescriberReference } from "./prescriber";
import { getResourceByNpiNumber, getSurescriptsDataSourceExtension } from "./shared";
import { SurescriptsContext } from "./types";
import { getNcpdpName } from "@metriport/shared/interface/external/surescripts/ncpdp";

export function getMedicationDispense(
  context: SurescriptsContext,
  medication: Medication,
  detail: ResponseDetail
): MedicationDispense {
  const daysSupply = getDaysSupply(detail);
  const performer = getMedicationDispensePerformer(context, detail);
  const quantity = getQuantity(detail);
  const dosageInstruction = getDosageInstruction(detail);
  const subject = getPatientReference(context.patient);
  const medicationReference = getMedicationReference(medication);
  const whenHandedOver = getWhenHandedOver(detail);
  const fillNumber = getFillNumberAsExtension(detail);
  const extensions = [fillNumber, getSurescriptsDataSourceExtension()].filter(
    Boolean
  ) as Extension[];

  const medicationDispense: MedicationDispense = {
    resourceType: "MedicationDispense",
    id: uuidv7(),
    subject,
    medicationReference,
    status: "completed",
    ...(quantity ? { quantity } : undefined),
    ...(whenHandedOver ? { whenHandedOver } : undefined),
    ...(dosageInstruction ? { dosageInstruction } : undefined),
    ...(daysSupply ? { daysSupply } : undefined),
    ...(performer.length > 0 ? { performer } : undefined),
    extension: extensions,
  };

  return medicationDispense;
}

function getQuantity(detail: ResponseDetail): MedicationDispense["quantity"] | undefined {
  if (!detail.quantityDispensed || !detail.quantityUnitOfMeasure) {
    return undefined;
  }
  const unit = getNcpdpName(detail.quantityUnitOfMeasure) ?? detail.quantityUnitOfMeasure;
  const value = Number(detail.quantityDispensed);
  if (!Number.isFinite(value)) return undefined;

  return {
    value,
    unit,
    system: UNIT_OF_MEASURE_URL,
    code: detail.quantityUnitOfMeasure,
  };
}
function getWhenHandedOver(
  detail: ResponseDetail
): MedicationDispense["whenHandedOver"] | undefined {
  if (!detail.dateWritten) return undefined;
  return buildDayjs(detail.dateWritten).toISOString();
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
