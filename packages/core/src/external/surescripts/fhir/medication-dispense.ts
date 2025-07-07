import {
  Extension,
  Medication,
  MedicationRequest,
  Patient,
  Organization,
  MedicationDispense,
  MedicationDispensePerformer,
} from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { buildDayjs } from "@metriport/shared/common/date";
import { ResponseDetail } from "../schema/response";
import { MEDICATION_DISPENSE_FILL_NUMBER_EXTENSION, UNIT_OF_MEASURE_URL } from "./constants";
import { getMedicationReference } from "./medication";
import { getMedicationRequestReference } from "./medication-request";
import { getPatientReference } from "./patient";
import { getSurescriptsDataSourceExtension } from "./shared";
import { getNcpdpName } from "@metriport/shared/interface/external/surescripts/ncpdp";
import { getPharmacyReference } from "./pharmacy";

export function getMedicationDispense({
  pharmacy,
  medicationRequest,
  patient,
  medication,
  detail,
}: {
  pharmacy?: Organization | undefined;
  medicationRequest?: MedicationRequest | undefined;
  medication: Medication;
  detail: ResponseDetail;
  patient: Patient;
}): MedicationDispense {
  const daysSupply = getDaysSupply(detail);
  const medicationReference = getMedicationReference(medication);
  const performer = getMedicationDispensePerformer(pharmacy);
  const authorizingPrescription = getAuthorizingPrescription(medicationRequest);
  const quantity = getQuantity(detail);
  const dosageInstruction = getDosageInstruction(detail);
  const subject = getPatientReference(patient);
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
    ...(authorizingPrescription ? { authorizingPrescription } : undefined),
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
  if (!detail.soldDate) {
    if (detail.dateWritten) {
      return buildDayjs(detail.dateWritten).toISOString();
    }
    if (detail.lastFilledDate) {
      return buildDayjs(detail.lastFilledDate).toISOString();
    }
    return undefined;
  }
  return buildDayjs(detail.soldDate).toISOString();
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

function getMedicationDispensePerformer(pharmacy?: Organization): MedicationDispensePerformer[] {
  if (!pharmacy) return [];
  const actor = getPharmacyReference(pharmacy);
  return [
    {
      id: uuidv7(),
      actor,
    },
  ];
}

function getAuthorizingPrescription(
  medicationRequest?: MedicationRequest
): MedicationDispense["authorizingPrescription"] | undefined {
  if (!medicationRequest) return undefined;
  return [getMedicationRequestReference(medicationRequest)];
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
