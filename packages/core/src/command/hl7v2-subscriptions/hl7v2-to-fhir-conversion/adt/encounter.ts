import { Hl7Message } from "@medplum/core";
import { Coding, Encounter, Resource } from "@medplum/fhirtypes";
import { buildPatientReference } from "../../../../external/fhir/shared/references";
import { uuidv7 } from "../../../../util/uuid-v7";
import { MessageType } from "../msh";
import { getSegmentByNameOrFail } from "../shared";
import { getAdmitReasonFromPatientVisitAddon } from "./condition";
import { getLocationFromAdt } from "./location";
import { getParticipantsFromAdt } from "./practitioner";
import { getPatientClassCode, getPeriodFromPatientVisit } from "./utils";

const adtPatientClass = ["B", "C", "E", "I", "N", "O", "P", "R", "U"] as const;
export type AdtPatientClass = (typeof adtPatientClass)[number];

type CodingWithCodeAndDisplay = Coding & {
  code: string;
  display: string;
};

// TODO 2883: Not sure this is a good class for default
const DEFAULT_ENCOUNTER_CLASS: CodingWithCodeAndDisplay = {
  code: "AMB",
  display: "ambulatory",
};

/**
 * Contains the mapping for HL7 ADT Patient Class code to FHIR R4 Encounter class code.
 *
 * @see {@link https://hl7-definition.caristix.com/v2/HL7v2.5.1/Tables/0004}
 * @see {@link https://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html}
 */
const adtToFhirEncounterClassMap: Record<AdtPatientClass, CodingWithCodeAndDisplay> = {
  B: { code: "IMP", display: "inpatient encounter" }, // Obstetrics → Inpatient
  C: { code: "AMB", display: "ambulatory" }, // Commercial Account → Ambulatory
  E: { code: "EMER", display: "emergency" }, // Emergency → Emergency
  I: { code: "IMP", display: "inpatient encounter" }, // Inpatient → Inpatient
  N: DEFAULT_ENCOUNTER_CLASS, // Not Applicable → Default to Ambulatory
  O: { code: "AMB", display: "ambulatory" }, // Outpatient → Ambulatory
  P: { code: "PRENC", display: "pre-admission" }, // Preadmit → Pre-admission
  R: { code: "SS", display: "short stay" }, // Recurring patient → Short stay
  U: DEFAULT_ENCOUNTER_CLASS, // Unknown → Default to Ambulatory
};

export function mapEncounterAndRelatedResources(
  adt: Hl7Message,
  messageType: MessageType,
  patientId: string
): Resource[] {
  const status = inferStatusFromMessage(messageType);
  const pv1Segment = getSegmentByNameOrFail(adt, "PV1");
  const encounterClass = getClassFromPatientVisit(adt);
  const period = getPeriodFromPatientVisit(adt);
  const participants = getParticipantsFromAdt(pv1Segment);

  const admitReason = getAdmitReasonFromPatientVisitAddon(adt, patientId);

  const location = getLocationFromAdt(adt);

  const encounter: Encounter = {
    id: uuidv7(), // TODO 2883: replace with actual ID generation logic, keeping it consistent across A01/A03. See if PV1.19 can be used here
    resourceType: "Encounter",
    status,
    class: encounterClass,
    ...(period ? { period } : undefined),
    ...(admitReason
      ? {
          reasonCode: admitReason.reasonCode,
          diagnosis: admitReason.diagnosis,
        }
      : undefined),
    subject: buildPatientReference(patientId),
    ...(participants ? { participant: participants.references } : undefined),
    ...(location ? { location: [location.locationReference] } : undefined),
  };

  return [
    encounter,
    ...(admitReason ? [admitReason.condition] : []),
    ...(participants?.practitioners ?? []),
    ...(location ? [location.location] : []),
  ];
}

/**
 * Maps HL7 message type to FHIR Encounter status.
 *
 * TODO: See if we can get the status from the ADT message itself
 * TODO: Handle more message types
 *
 * @see {@link https://hl7.org/fhir/R4/valueset-encounter-status.html}
 */
function inferStatusFromMessage(messageType: MessageType): NonNullable<Encounter["status"]> {
  switch (messageType.structure) {
    case "ADT_A01":
      return "in-progress";
    case "ADT_A03":
      return "finished";
    default:
      return "unknown";
  }
}

function getClassFromPatientVisit(adt: Hl7Message): Coding {
  const patientClassCode = getPatientClassCode(adt);

  if (!isAdtPatientClass(patientClassCode)) {
    return DEFAULT_ENCOUNTER_CLASS;
  }

  return mapAdtPatientClassToFhirEncounterClass(patientClassCode as AdtPatientClass);
}

function isAdtPatientClass(code: string): code is AdtPatientClass {
  return adtPatientClass.includes(code as AdtPatientClass);
}

/**
 * Maps an HL7 ADT Patient Class code to a FHIR R4 Encounter class code.
 *
 * @param {AdtPatientClass} adtPatientClass - The HL7 ADT Patient Class code.
 * @returns {Coding} - The corresponding FHIR Encounter class coding.
 */
function mapAdtPatientClassToFhirEncounterClass(adtPatientClass: AdtPatientClass): Coding {
  const fhirClass = adtToFhirEncounterClassMap[adtPatientClass];

  return {
    code: fhirClass.code,
    display: fhirClass.display,
    system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  };
}
