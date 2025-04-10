import { Hl7Message, Hl7Segment } from "@medplum/core";
import { Coding, Encounter } from "@medplum/fhirtypes";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { buildPeriod } from "../../../../external/fhir/shared/timestamps";
import { uuidv7 } from "../../../../util/uuid-v7";
import {
  getOptionalValueFromField,
  getOptionalValueFromMessage,
  getOptionalValueFromSegment,
  getRequiredValueFromMessage,
  getSegmentByNameOrFail,
  mapAdtSystemNameToSystemUrl,
} from "../shared";
import { buildConditionCoding } from "./condition";

type ConditionOffset = 0 | 3;

type HumanNameDetails = {
  family: string;
  given: string;
  secondaryGivenNames: string | undefined;
  suffix: string | undefined;
  prefix: string | undefined;
};

export function getPeriodFromPatientVisit(adt: Hl7Message): Encounter["period"] | undefined {
  const pv1Segment = getSegmentByNameOrFail(adt, "PV1");

  const start = getOptionalValueFromSegment(pv1Segment, 44, 1);
  const end = getOptionalValueFromSegment(pv1Segment, 45, 1);

  return buildPeriod(start, end);
}

export function getPatientClassCode(adt: Hl7Message): string {
  return getRequiredValueFromMessage(adt, "PV1", 2, 1);
}

export function getFacilityName(adt: Hl7Message): string | undefined {
  const evn = getSegmentByNameOrFail(adt, "EVN");
  const eventFacilityNamespace = getOptionalValueFromSegment(evn, 7, 1);
  const eventFacilityUniversalId = getOptionalValueFromSegment(evn, 7, 2);
  if (eventFacilityNamespace || eventFacilityUniversalId) {
    return [eventFacilityNamespace, eventFacilityUniversalId].filter(Boolean).join(" - ");
  }

  const pv1 = getSegmentByNameOrFail(adt, "PV1");
  const servicingFacilityName = getOptionalValueFromSegment(pv1, 39, 1);
  if (servicingFacilityName) return servicingFacilityName;

  const assignedPatientLocationFacility = getOptionalValueFromSegment(pv1, 3, 4);
  return assignedPatientLocationFacility ?? undefined;
}

export function getAttendingDoctorNameDetails(adt: Hl7Message): HumanNameDetails | undefined {
  const pv1Segment = getSegmentByNameOrFail(adt, "PV1");
  const attendingDoctorField = pv1Segment.getField(7);
  if (attendingDoctorField.components.length < 1) return undefined;

  const family = attendingDoctorField.getComponent(2);
  const given = attendingDoctorField.getComponent(3);
  const secondaryGivenNames = getOptionalValueFromField(attendingDoctorField, 4);
  const suffix = getOptionalValueFromField(attendingDoctorField, 5);
  const prefix = getOptionalValueFromField(attendingDoctorField, 6);

  return { family, given, secondaryGivenNames, suffix, prefix };
}

export function getConditionCoding(
  pv2Segment: Hl7Segment,
  offset: ConditionOffset = 0
): Coding | undefined {
  const conditionCode = getOptionalValueFromSegment(pv2Segment, 3, 1 + offset);
  const conditionDisplay = getOptionalValueFromSegment(pv2Segment, 3, 2 + offset);
  const conditionSystem = getOptionalValueFromSegment(pv2Segment, 3, 3 + offset);

  const system = mapAdtSystemNameToSystemUrl(conditionSystem);

  return buildConditionCoding({
    code: conditionCode,
    display: conditionDisplay,
    system,
  });
}

export function createEncounterId(adt: Hl7Message, patientId: string) {
  const visitNumber = getOptionalValueFromMessage(adt, "PV1", 19, 1);
  if (visitNumber) return createUuidFromText(`${visitNumber}-${patientId}`);

  const accountNumber = getOptionalValueFromMessage(adt, "PV1", 18, 1);
  if (accountNumber) return createUuidFromText(`${accountNumber}-${patientId}`);

  const mrn = getOptionalValueFromMessage(adt, "PID", 3, 1);
  const admitDate = getOptionalValueFromMessage(adt, "PV1", 44, 1);

  if (mrn && admitDate) {
    return createUuidFromText(`${mrn}-${admitDate}`);
  }

  return uuidv7();
}
