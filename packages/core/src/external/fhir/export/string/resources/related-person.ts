import { RelatedPerson } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAddresses } from "../shared/address";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatHumanNames } from "../shared/human-name";
import { formatIdentifiers } from "../shared/identifier";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatTelecoms } from "../shared/telecom";

/**
 * Converts a FHIR RelatedPerson resource to a string representation
 */
export class RelatedPersonToString implements FHIRResourceToString<RelatedPerson> {
  toString(person: RelatedPerson, isDebug?: boolean): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: person.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (person.active) parts.push(isDebug ? `Active: ${person.active}` : String(person.active));

    // if (person.patient) {
    //   const patientStr = formatReferences([person.patient], "Patient");
    //   if (patientStr) parts.push(patientStr);
    // }

    const relationshipStr = formatCodeableConcepts({
      concepts: person.relationship,
      label: "Relationship",
      isDebug,
    });
    if (relationshipStr) {
      parts.push(relationshipStr);
      hasMinimumData = true;
    }

    if (person.name) {
      const names = formatHumanNames({ names: person.name, isDebug });
      if (names) parts.push(names);
    }

    const telecoms = formatTelecoms({ telecoms: person.telecom, label: "Telecom", isDebug });
    if (telecoms) parts.push(telecoms);

    if (person.gender) parts.push(isDebug ? `Gender: ${person.gender}` : person.gender);

    if (person.birthDate)
      parts.push(isDebug ? `Birth Date: ${person.birthDate}` : person.birthDate);

    const addresses = formatAddresses({ addresses: person.address, label: "Address", isDebug });
    if (addresses) parts.push(addresses);

    // if (person.photo) {
    //   const photos = person.photo
    //     .map(photo => {
    //       const contentType = photo.contentType ? `Content Type: ${photo.contentType}` : undefined;
    //       const url = photo.url ? `URL: ${photo.url}` : undefined;
    //       const size = photo.size ? `Size: ${photo.size}` : undefined;
    //       const hash = photo.hash ? `Hash: ${photo.hash}` : undefined;
    //       return [contentType, url, size, hash].filter(Boolean).join(FIELD_SEPARATOR);
    //     })
    //     .filter(Boolean);

    //   if (photos.length > 0) {
    //     parts.push(`Photos: ${photos.join(FIELD_SEPARATOR)}`);
    //     hasMinimumData = true;
    //   }
    // }

    // if (person.communication) {
    //   const communications = person.communication
    //     .map(comm => {
    //       const language = comm.language
    //         ? formatCodeableConcepts([comm.language], "Language")
    //         : undefined;
    //       const preferred = comm.preferred ? `Preferred: ${comm.preferred}` : undefined;
    //       return [language, preferred].filter(Boolean).join(FIELD_SEPARATOR);
    //     })
    //     .filter(Boolean);

    //   if (communications.length > 0) {
    //     parts.push(`Communications: ${communications.join(FIELD_SEPARATOR)}`);
    //     hasMinimumData = true;
    //   }
    // }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
