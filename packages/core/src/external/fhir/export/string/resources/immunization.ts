import { Immunization } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcept } from "../shared/codeable-concept";
import { emptyIfDenied } from "../shared/deny";
import { formatIdentifiers } from "../shared/identifier";
import { formatQuantity } from "../shared/quantity";
import { formatReference, formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Immunization resource to a string representation
 */
export class ImmunizationToString implements FHIRResourceToString<Immunization> {
  toString(immunization: Immunization, isDebug?: boolean): string | undefined {
    const parts: string[] = [];
    let hasMinimumData = defaultHasMinimumData;

    const identifierStr = formatIdentifiers({ identifiers: immunization.identifier });
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (immunization.status) {
      parts.push(isDebug ? `Status: ${immunization.status}` : immunization.status);
    }

    const codeStr = formatCodeableConcept({
      concept: immunization.vaccineCode,
      label: "Vaccine",
      isDebug,
    });
    if (codeStr) {
      parts.push(codeStr);
      hasMinimumData = true;
    }

    if (immunization.occurrenceDateTime) {
      parts.push(
        isDebug ? `Occurrence: ${immunization.occurrenceDateTime}` : immunization.occurrenceDateTime
      );
    }

    if (immunization.primarySource) {
      parts.push(`Primary Source`);
    }

    const manufacturerStr = formatReference({
      reference: immunization.manufacturer,
      label: "Manufacturer",
      isDebug,
    });
    if (manufacturerStr) {
      parts.push(manufacturerStr);
    }

    const lotNumber = emptyIfDenied(immunization.lotNumber);
    if (lotNumber) {
      parts.push(isDebug ? `Lot Number: ${lotNumber}` : lotNumber);
      hasMinimumData = true;
    }

    if (immunization.expirationDate) {
      parts.push(
        isDebug ? `Expiration: ${immunization.expirationDate}` : immunization.expirationDate
      );
    }

    const siteStr = formatCodeableConcept({
      concept: immunization.site,
      label: "Site",
      isDebug,
    });
    if (siteStr) {
      parts.push(siteStr);
    }

    const routeStr = formatCodeableConcept({
      concept: immunization.route,
      label: "Route",
      isDebug,
    });
    if (routeStr) {
      parts.push(routeStr);
    }

    const doseStr = formatQuantity({
      quantity: immunization.doseQuantity,
      label: "Dose",
      isDebug,
    });
    if (doseStr) {
      parts.push(doseStr);
    }

    const performerStr = formatReferences({
      references: immunization.performer,
      label: "Performer",
      isDebug,
    });
    if (performerStr) {
      parts.push(performerStr);
    }

    const notes = formatAnnotations({ annotations: immunization.note, label: "Note", isDebug });
    if (notes) {
      parts.push(notes);
      hasMinimumData = true;
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
