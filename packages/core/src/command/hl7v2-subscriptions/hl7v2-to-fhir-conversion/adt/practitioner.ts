import { Hl7Field, Hl7Segment } from "@medplum/core";
import { EncounterParticipant, HumanName, Practitioner } from "@medplum/fhirtypes";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { buildEncounterParticipant } from "../../../../external/fhir/shared/references";
import { getOptionalValueFromField } from "../shared";

type PractitionerWithId = Practitioner & {
  id: string;
};

type AdtParticipants = {
  practitioners: PractitionerWithId[];
  references: EncounterParticipant[];
};

export function getParticipantsFromAdt(pv1Segment: Hl7Segment): AdtParticipants | undefined {
  const attendingDoctorField = pv1Segment.getField(7);
  if (attendingDoctorField.components.length === 0) return undefined;

  const attendingDoctorDetails = getPractitionerDetailsFromField(attendingDoctorField);
  const attendingPractitioner = buildPractitioner(attendingDoctorDetails);

  const practitioners = [attendingPractitioner];

  const references = buildParticipantReferences(practitioners.map(p => p.id));

  return {
    practitioners,
    references,
  };
}

function getPractitionerDetailsFromField(docField: Hl7Field): Partial<Practitioner> {
  const family = docField.getComponent(2);
  const given = docField.getComponent(3);
  const secondaryGivenNames = getOptionalValueFromField(docField, 4);
  const suffix = getOptionalValueFromField(docField, 5);
  const prefix = getOptionalValueFromField(docField, 6);

  const givenNames = [given, secondaryGivenNames].flatMap(n => n || []);
  const name = buildHumanName(family, givenNames, prefix, suffix);

  return {
    name,
  };
}

function buildHumanName(
  family: string,
  given: string[],
  prefix?: string | undefined,
  suffix?: string | undefined
): HumanName[] {
  return [
    {
      ...(prefix ? { prefix: [prefix] } : undefined),
      family,
      given,
      ...(suffix ? { suffix: [suffix] } : undefined),
    },
  ];
}

export function buildPractitioner(params: Partial<Practitioner> = {}): PractitionerWithId {
  const { id, name, ...remainingParams } = params;

  const deterministicID = createUuidFromText(JSON.stringify(name));
  return {
    id: id ?? deterministicID, // TODO 2883: Remove backup ID and make this deterministic
    resourceType: "Practitioner",
    ...(name ? { name } : undefined),
    ...remainingParams,
  };
}

export function buildParticipantReferences(ids: string[]): EncounterParticipant[] {
  const participants: EncounterParticipant[] = [];

  for (const id of ids) {
    participants.push(buildEncounterParticipant({ practitionerId: id }));
  }

  return participants;
}
