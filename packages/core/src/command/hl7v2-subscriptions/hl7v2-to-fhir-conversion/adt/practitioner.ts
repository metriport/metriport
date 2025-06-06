import { Hl7Message } from "@medplum/core";
import { EncounterParticipant, HumanName, Practitioner } from "@medplum/fhirtypes";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { buildEncounterParticipant } from "../../../../external/fhir/shared/references";
import { getAttendingDoctorNameDetails } from "./utils";

type PractitionerWithId = Practitioner & {
  id: string;
};

type AdtParticipants = {
  practitioners: PractitionerWithId[];
  references: EncounterParticipant[];
};

export function getParticipantsFromAdt(adt: Hl7Message): AdtParticipants | undefined {
  const practitioners: PractitionerWithId[] = [];

  const attendingDoctorDetails = getAttendingDoctorDetailsFromAdt(adt);
  if (attendingDoctorDetails) {
    practitioners.push(buildPractitioner(attendingDoctorDetails));
  }

  if (practitioners.length < 1) return undefined;
  // TODO 2883: Add other practitioners from the ADT message, if available

  const references = practitioners.map(p => buildEncounterParticipant({ practitionerId: p.id }));
  return {
    practitioners,
    references,
  };
}

function getAttendingDoctorDetailsFromAdt(adt: Hl7Message): Partial<Practitioner> | undefined {
  const attendingDocNameDetails = getAttendingDoctorNameDetails(adt);
  if (!attendingDocNameDetails) return undefined;

  const { family, given, secondaryGivenNames, suffix, prefix } = attendingDocNameDetails;

  // TODO: Improve mapping from what's returned from ADT to buildHumanName.. This current version is kinda clunky
  const givenNames = [given, secondaryGivenNames].flatMap(n => n ?? []);
  const name = buildHumanName(family, givenNames, prefix, suffix);

  return {
    name: [name],
  };
}

function buildHumanName(
  family: string,
  given: string[],
  prefix?: string | undefined,
  suffix?: string | undefined
): HumanName {
  return {
    ...(prefix ? { prefix: [prefix] } : undefined),
    family,
    ...(given.length > 0 ? { given } : undefined),
    ...(suffix ? { suffix: [suffix] } : undefined),
  };
}

export function buildPractitioner(params: Partial<Practitioner>): PractitionerWithId {
  const { id, name, ...rest } = params;

  return {
    id: id ?? createUuidFromText(JSON.stringify(name)),
    resourceType: "Practitioner",
    ...(name ? { name } : undefined),
    ...rest,
  };
}
