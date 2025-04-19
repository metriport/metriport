import { Hl7Message } from "@medplum/core";
import { Coding, Encounter, Resource } from "@medplum/fhirtypes";
import { buildPatientReference } from "../../../../external/fhir/shared/references";
import { Hl7MessageType, getHl7MessageTypeOrFail } from "../msh";
import { getConditionsAndReferences } from "./condition";
import { getLocationFromAdt } from "./location";
import { DEFAULT_ENCOUNTER_CLASS, adtToFhirEncounterClassMap, isAdtPatientClass } from "./mappings";
import { getParticipantsFromAdt } from "./practitioner";
import { createEncounterId, getEncounterPeriod, getPatientClassCode } from "./utils";

export function mapEncounterAndRelatedResources(adt: Hl7Message, patientId: string): Resource[] {
  const msgType = getHl7MessageTypeOrFail(adt);
  const status = getPatientStatus(msgType);
  const encounterClass = getEncounterClass(adt);
  const period = getEncounterPeriod(adt);
  const participants = getParticipantsFromAdt(adt);
  const conditionsAndRefs = getConditionsAndReferences(adt, patientId);
  const location = getLocationFromAdt(adt);

  const encounter: Encounter = {
    id: createEncounterId(adt, patientId),
    resourceType: "Encounter",
    status,
    class: encounterClass,
    ...(period ? { period } : undefined),
    ...(conditionsAndRefs.reasonCode ? { reasonCode: conditionsAndRefs.reasonCode } : undefined),
    ...(conditionsAndRefs.refs.length > 0 ? { diagnosis: conditionsAndRefs.refs } : undefined),
    subject: buildPatientReference(patientId),
    ...(participants ? { participant: participants.references } : undefined),
    ...(location ? { location: [location.locationReference] } : undefined),
  };

  return [
    encounter,
    ...conditionsAndRefs.conditions,
    ...(participants?.practitioners ?? []),
    ...(location ? [location.location] : []),
  ];
}

/**
 * Infers the Encounter status from the message trigger event type.
 * i.e. A01 => in-progress
 *
 * TODO: See if we can get the status from the ADT message itself
 * TODO: Handle more message types
 *
 * @see {@link https://hl7.org/fhir/R4/valueset-encounter-status.html}
 */
function getPatientStatus(messageType: Hl7MessageType): NonNullable<Encounter["status"]> {
  switch (messageType.triggerEvent) {
    case "A01":
      return "in-progress";
    case "A03":
      return "finished";
    default:
      return "unknown";
  }
}

/**
 * Maps an HL7 ADT Patient Class code to a FHIR R4 Encounter class code.
 *
 * @returns {Coding} - The corresponding FHIR Encounter class coding.
 */
function getEncounterClass(adt: Hl7Message): Coding {
  const patientClassCode = getPatientClassCode(adt);

  if (!patientClassCode || !isAdtPatientClass(patientClassCode)) {
    return DEFAULT_ENCOUNTER_CLASS;
  }
  const encounterClass = adtToFhirEncounterClassMap[patientClassCode];

  return {
    code: encounterClass.code,
    display: encounterClass.display,
    system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  };
}
