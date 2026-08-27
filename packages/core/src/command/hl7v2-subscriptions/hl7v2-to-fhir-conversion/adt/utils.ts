import { Hl7Field, Hl7Message } from "@medplum/core";
import { Coding, Encounter } from "@medplum/fhirtypes";
import { BAMBOO_HIE_NAME, KONZA_HIE_NAME } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { buildPeriod } from "../../../../external/fhir/shared/datetime";
import { uuidv7 } from "../../../../util/uuid-v7";
import { getMessageUniqueIdentifier } from "../msh";
import {
  getOptionalValueFromField,
  getOptionalValueFromMessage,
  getOptionalValueFromSegment,
  getSegmentByNameOrFail,
  mapHl7SystemNameToSystemUrl,
} from "../shared";

const NUMBER_OF_DATA_POINTS_PER_CONDITION = 3;
type CodingIndex = 0 | 1;

type HumanNameDetails = {
  family: string;
  given: string | undefined;
  secondaryGivenNames: string | undefined;
  suffix: string | undefined;
  prefix: string | undefined;
};

/**
 * Gets period from the Patient Visit (PV1) segment.
 */
export function getEncounterPeriod(adt: Hl7Message): Encounter["period"] | undefined {
  const pv1Segment = adt.getSegment("PV1");
  if (!pv1Segment) return undefined;

  const start = getOptionalValueFromSegment(pv1Segment, 44, 1);
  const end = getOptionalValueFromSegment(pv1Segment, 45, 1);

  return buildPeriod(start, end);
}

export function getPatientClassCode(adt: Hl7Message): string | undefined {
  return getOptionalValueFromMessage(adt, "PV1", 2, 1);
}

/**
 * Gets the discharge disposition from PV1.36.
 *
 * @see {@link https://hl7-definition.caristix.com/v2/HL7v2.5.1/Fields/PV1.36}
 */
export function getDischargeDisposition(adt: Hl7Message): string | undefined {
  return getOptionalValueFromMessage(adt, "PV1", 36, 1);
}

// Note this is a temporary hack to fix Konza adts. A proper solution with a strategy pattern is planned in the near future.
export function getFacilityName(adt: Hl7Message, hieName: string): string | undefined {
  const facilityNameFromZfaSegment = getLocationNameFromCustomZfaSegment(adt, hieName);
  if (facilityNameFromZfaSegment) return facilityNameFromZfaSegment;

  const evn = getSegmentByNameOrFail(adt, "EVN");
  const eventFacilityNamespace = getOptionalValueFromSegment(evn, 7, 1);
  const eventFacilityUniversalId = getOptionalValueFromSegment(evn, 7, 2);
  if (eventFacilityNamespace || eventFacilityUniversalId) {
    return [eventFacilityNamespace, eventFacilityUniversalId].filter(Boolean).join(" - ");
  }

  const servicingFacilityName = getServicingFacilityName(adt, hieName);
  if (servicingFacilityName) return servicingFacilityName;

  const pv1Segment = adt.getSegment("PV1");
  if (!pv1Segment) return undefined;
  const assignedPatientLocationFacility = getOptionalValueFromSegment(pv1Segment, 3, 4);
  if (assignedPatientLocationFacility) return assignedPatientLocationFacility;

  return undefined;
}

const KONZA_SERVICING_FACILITY_NAME_INDEX = 2; // HL7V2 component (1 indexed)
const DEFAULT_SERVICING_FACILITY_NAME_INDEX = 1; // HL7V2 component (1 indexed)

function getServicingFacilityName(adt: Hl7Message, hieName: string): string | undefined {
  const pv1Segment = adt.getSegment("PV1");
  if (!pv1Segment) return undefined;

  if (hieName === KONZA_HIE_NAME) {
    return getOptionalValueFromSegment(pv1Segment, 39, KONZA_SERVICING_FACILITY_NAME_INDEX);
  }
  return getOptionalValueFromSegment(pv1Segment, 39, DEFAULT_SERVICING_FACILITY_NAME_INDEX);
}

const ZFA_LOCATION_NAME_INDEX = 2; // HL7V2 field (1 indexed)
function getLocationNameFromCustomZfaSegment(adt: Hl7Message, hieName: string): string | undefined {
  if (hieName !== BAMBOO_HIE_NAME) return undefined;

  const zfaSegment = adt.getSegment("ZFA");
  if (!zfaSegment) return undefined;

  const locationName = getOptionalValueFromSegment(zfaSegment, ZFA_LOCATION_NAME_INDEX, 1);
  if (!locationName) return undefined;
  return locationName;
}

export function getAttendingDoctorNameDetails(adt: Hl7Message): HumanNameDetails | undefined {
  const pv1Segment = adt.getSegment("PV1");
  if (!pv1Segment) return undefined;

  const attendingDoctorField = pv1Segment.getField(7);
  if (attendingDoctorField.components.length < 1) return undefined;

  const family = getOptionalValueFromField(attendingDoctorField, 2);
  if (!family) return undefined;

  const given = getOptionalValueFromField(attendingDoctorField, 3);
  const secondaryGivenNames = getOptionalValueFromField(attendingDoctorField, 4);
  const suffix = getOptionalValueFromField(attendingDoctorField, 5);
  const prefix = getOptionalValueFromField(attendingDoctorField, 6);

  return { family, given, secondaryGivenNames, suffix, prefix };
}

export function getCoding(field: Hl7Field, codingPosition: CodingIndex): Coding | undefined {
  const offset = codingPosition * NUMBER_OF_DATA_POINTS_PER_CONDITION;

  const code = getOptionalValueFromField(field, 1 + offset);
  const display = getOptionalValueFromField(field, 2 + offset);
  const system = getOptionalValueFromField(field, 3 + offset);

  const normalizedSystem = mapHl7SystemNameToSystemUrl(system);

  return buildCoding({
    code,
    display,
    system: normalizedSystem,
  });
}

export function getPotentialIdentifiers(adt: Hl7Message, hieName: string) {
  const visitNumber = getOptionalValueFromMessage(adt, "PV1", 19, 1);
  const accountNumber = getOptionalValueFromMessage(adt, "PV1", 18, 1);
  const mrn = getOptionalValueFromMessage(adt, "PID", 3, 1);
  const admitDate = getOptionalValueFromMessage(adt, "PV1", 44, 1);
  const facilityName = getFacilityName(adt, hieName);
  const messageId = getMessageUniqueIdentifier(adt);

  return {
    visitNumber,
    accountNumber,
    mrn,
    admitDate,
    facilityName,
    messageId,
  };
}

/**
 * ⚠️ UUID key must always include all of the potential identifiers used downstream in deduplication.
 * In this case, we are using the admit date to deduplicate encounters so we need to include that in the UUID key.
 */
export function createEncounterId(adt: Hl7Message, patientId: string, hieName: string) {
  const { visitNumber, accountNumber, mrn, admitDate, facilityName, messageId } =
    getPotentialIdentifiers(adt, hieName);

  if (visitNumber) return createUuidFromText(`${visitNumber}-${patientId}-${admitDate}`);
  if (accountNumber) return createUuidFromText(`${accountNumber}-${patientId}-${admitDate}`);
  if (mrn && admitDate) {
    return createUuidFromText(`${mrn}-${admitDate}`);
  }
  if (facilityName && messageId) {
    return createUuidFromText(`${facilityName}-${messageId}-${admitDate}`);
  }

  return uuidv7();
}

export function buildCoding({
  code,
  display,
  system,
}: {
  code?: string | undefined;
  display?: string | undefined;
  system?: string | undefined;
}): Coding | undefined {
  if (!code && !display) return undefined;

  if (!system) {
    if (!display) return undefined;
    return { display };
  }

  return {
    ...(code ? { code } : undefined),
    ...(display ? { display } : undefined),
    ...(system ? { system: system } : undefined),
  };
}
