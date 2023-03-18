import { getId, Person } from "@metriport/commonwell-sdk";
import { differenceBy } from "lodash";

import { MedicalDataSource } from "../../../external";
import { GenderAtBirth } from "../../../models/medical/patient";

export type PatientLinkStatusDTO = "linked" | "needs-review";
export type PatientLinksDTO = { [k in MedicalDataSource]: PatientLinkStatusDTO };

// TODO can we reuse PatientDTO?
export type PatientLinkDTO = {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  genderAtBirth: GenderAtBirth;
  address: {
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
};
export type LinkDTO = {
  id?: string | null;
  entityId: string;
  potential: boolean;
  source: MedicalDataSource;
  patient: PatientLinkDTO;
};
export type PatientLinks = {
  potentialLinks: LinkDTO[];
  currentLinks: LinkDTO[];
};

export function dtoFromCW({
  cwPotentialPersons,
  cwCurrentPersons,
}: {
  cwPotentialPersons: Person[];
  cwCurrentPersons: Person[];
}): PatientLinks {
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

  const address = person.details?.address?.length ? person.details?.address[0] : undefined;
  const personName = person.details?.name?.length ? person.details?.name[0] : undefined;

  if (personId) {
    const personLink: LinkDTO = {
      entityId: personId,
      potential: true,
      source: MedicalDataSource.COMMONWELL,
      patient: {
        id: personId,
        firstName: personName && personName.given?.length ? personName.given[0] : "",
        lastName: personName && personName.family?.length ? personName.family[0] : "",
        dob: person.details?.birthDate ? person.details.birthDate : "",
        genderAtBirth: displayGender(person),
        address: {
          addressLine1: address && address.line ? address.line[0] : "",
          city: address && address.city ? address.city : "",
          state: address && address.state ? address.state : "",
          zip: address && address.zip ? address.zip : "",
          country: address && address.country ? address.country : "",
        },
      },
    };

    return personLink;
  }

  return null;
}

const displayGender = (person: Person): GenderAtBirth => {
  const genderCode = person.details?.gender?.code;
  if (genderCode && genderCode === "F") return "F";

  return "M";
};
