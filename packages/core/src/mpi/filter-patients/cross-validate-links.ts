import { PatientData } from "../../domain/patient";
import { isContactMatch } from "./match-contact";
import { isAddressMatch } from "./match-address";

export function crossValidateInvalidLinks(
  validLinks: PatientData[],
  invalidLinks: PatientData[]
): PatientData[] {
  if (validLinks.length === 0 || invalidLinks.length === 0) {
    return [];
  }

  const crossValidatedLinks: PatientData[] = [];

  for (const invalidLink of invalidLinks) {
    const isValidated = validateLinkThroughValidLinks(invalidLink, validLinks);

    if (isValidated) {
      crossValidatedLinks.push(invalidLink);
    }
  }

  return crossValidatedLinks;
}

function validateLinkThroughValidLinks(
  invalidLink: PatientData,
  validLinks: PatientData[]
): boolean {
  for (const validLink of validLinks) {
    const hasContactMatch = invalidLink.contact?.some(invalidContact =>
      validLink.contact?.some(validContact => isContactMatch(invalidContact, validContact))
    );

    if (hasContactMatch) {
      return true;
    }

    const hasAddressMatch = invalidLink.address?.some(invalidAddr =>
      validLink.address?.some(validAddr => isAddressMatch(invalidAddr, validAddr))
    );

    if (hasAddressMatch) {
      return true;
    }
  }

  return false;
}
