import { intersectionWith } from "lodash";
import { PatientData } from "../../domain/patient";
import { isContactMatch } from "./match-contact";
import { hasAddressMatch } from "./match-address";
import { calculateLastNameScore, calculateFirstNameScore } from "./match-name";
import { calculateDobScore } from "./match-dob";

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
      const hasFirstNameMatch = calculateFirstNameScore(invalidLink, validLink);
      const hasDobMatch = calculateDobScore(invalidLink, validLink) > 0;
      const hasAddressMatchByAssociation = hasAddressMatch(invalidLink, validLink);

      if (hasFirstNameMatch || hasDobMatch || hasAddressMatchByAssociation) {
        return true;
      }
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
