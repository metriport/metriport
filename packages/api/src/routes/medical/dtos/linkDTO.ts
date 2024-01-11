import { getId, Person } from "@metriport/commonwell-sdk";
import { differenceBy } from "lodash";
import { joinName } from "../../../domain/medical/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { DemographicsDTO, GenderDTO } from "./demographicsDTO";

export type LinkDTO = {
  id?: string | null;
  entityId: string;
  potential: boolean;
  source: MedicalDataSource;
  patient: PatientOnLinkDTO;
};

export type PatientOnLinkDTO = { id: string } & DemographicsDTO;

export type PatientLinksDTO = {
  potentialLinks: LinkDTO[];
  currentLinks: LinkDTO[];
};

export function dtoFromCW({
  cwPotentialPersons,
  cwCurrentPersons,
}: {
  cwPotentialPersons: Person[];
  cwCurrentPersons: Person[];
}): PatientLinksDTO {
  let potentialLinks: LinkDTO[] = [];
  const currentLinks: LinkDTO[] = [];

  cwPotentialPersons.forEach(person => {
    const personLink = convertFromCWPersonToLink(person);
    if (personLink) potentialLinks.push(personLink);
  });

  cwCurrentPersons.forEach(person => {
    const personLink = convertFromCWPersonToLink(person);
    if (personLink) currentLinks.push(personLink);
  });

  if (currentLinks.length) {
    const removePotentialLinksDuplicates = differenceBy(potentialLinks, currentLinks, "entityId");
    potentialLinks = removePotentialLinksDuplicates;
  }

  return {
    potentialLinks,
    currentLinks,
  };
}

export function convertFromCWPersonToLink(person: Person): LinkDTO | null {
  const personId = getId(person);
  if (personId) {
    const personLink: LinkDTO = {
      entityId: personId,
      potential: true,
      source: MedicalDataSource.COMMONWELL,
      patient: personToPatient({ ...person, id: personId }),
    };
    return personLink;
  }

  return null;
}

function personToPatient(person: { id: string } & Person): PatientOnLinkDTO {
  const address = person.details?.address?.length ? person.details?.address[0] : undefined;
  const personName = person.details?.name?.length ? person.details?.name[0] : undefined;
  return {
    id: person.id,
    firstName: personName && personName.given?.length ? joinName(personName.given) : "",
    lastName: personName && personName.family?.length ? joinName(personName.family) : "",
    dob: person.details?.birthDate ? person.details.birthDate : "",
    genderAtBirth: genderToDTO(person),
    address: [
      {
        addressLine1: address && address.line ? address.line[0] : "",
        city: address && address.city ? address.city : "",
        state: address && address.state ? address.state : "",
        zip: address && address.zip ? address.zip : "",
        country: address && address.country ? address.country : "USA",
      },
    ],
  };
}

const genderToDTO = (person: Person): GenderDTO => {
  const code = person.details?.gender?.code;
  return code === "M" || code === "F" ? code : "U";
};
