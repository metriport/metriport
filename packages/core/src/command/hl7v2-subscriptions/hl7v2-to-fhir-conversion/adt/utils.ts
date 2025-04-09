import { Hl7Message } from "@medplum/core";
import { Encounter } from "@medplum/fhirtypes";
import { buildPeriod } from "../../../../external/fhir/shared/timestamps";
import {
  getOptionalValueFromMessage,
  getOptionalValueFromSegment,
  getRequiredValueFromMessage,
  getSegmentByNameOrFail,
} from "../shared";

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
  const servicingFacilityName = getServicingFacilityName(adt);
  return servicingFacilityName ?? getAssignedPatientLocationFacility(adt);
}

function getServicingFacilityName(adt: Hl7Message): string | undefined {
  return getOptionalValueFromMessage(adt, "PV1", 39, 1);
}

function getAssignedPatientLocationFacility(adt: Hl7Message): string | undefined {
  return getOptionalValueFromMessage(adt, "PV1", 3, 4);
}
