import { intersectionWith } from "lodash";
import { PatientData } from "../../domain/patient";
import { isContactMatch } from "./match-contact";
import { hasAddressMatch } from "./match-address";
import { calculateLastNameScore } from "./match-name";

export function crossValidateInvalidLinks(
  validLinks: PatientData[],
  invalidLinks: PatientData[]
): PatientData[] {
  if (validLinks.length === 0 || invalidLinks.length === 0) {
    return [];
  }

  return invalidLinks.filter(invalidLink => isLinkValidByAssociation(invalidLink, validLinks));
}

function isLinkValidByAssociation(invalidLink: PatientData, validLinks: PatientData[]): boolean {
  for (const validLink of validLinks) {
    const hasLastNameMatch = calculateLastNameScore(invalidLink, validLink);

    if (hasLastNameMatch) {
      return true;
    }

    const hasContactMatchByAssociation =
      invalidLink.contact &&
      validLink.contact &&
      intersectionWith(invalidLink.contact, validLink.contact, isContactMatch).length > 0;

    if (hasContactMatchByAssociation) {
      return true;
    }

    const hasAddressMatchByAssociation = hasAddressMatch(invalidLink, validLink);

    if (hasAddressMatchByAssociation) {
      return true;
    }
  }

  return false;
}
