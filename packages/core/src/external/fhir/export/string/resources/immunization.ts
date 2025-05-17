import { Immunization } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { emptyIfDenied } from "../shared/deny";
import { formatIdentifiers } from "../shared/identifier";
import { formatQuantity } from "../shared/quantity";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Immunization resource to a string representation
 */
export class ImmunizationToString implements FHIRResourceToString<Immunization> {
  toString(immunization: Immunization): string | undefined {
    const parts: string[] = [];
    let hasMinimumData = defaultHasMinimumData;

    const identifierStr = formatIdentifiers(immunization.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    if (immunization.status) {
      parts.push(`Status: ${immunization.status}`);
    }

    if (immunization.vaccineCode) {
      const codeStr = formatCodeableConcepts([immunization.vaccineCode], "Vaccine");
      if (codeStr) {
        parts.push(codeStr);
        hasMinimumData = true;
      }
    }

    if (immunization.occurrenceDateTime) {
      parts.push(`Occurrence: ${immunization.occurrenceDateTime}`);
    }

    if (immunization.primarySource !== undefined) {
      parts.push(`Primary Source: ${immunization.primarySource}`);
    }

    if (immunization.manufacturer) {
      const manufacturerStr = formatReferences([immunization.manufacturer], "Manufacturer");
      if (manufacturerStr) {
        parts.push(manufacturerStr);
      }
    }

    if (immunization.lotNumber) {
      const lotNumber = emptyIfDenied(immunization.lotNumber);
      if (lotNumber) {
        parts.push(`Lot Number: ${lotNumber}`);
        hasMinimumData = true;
      }
    }

    if (immunization.expirationDate) {
      parts.push(`Expiration: ${immunization.expirationDate}`);
    }

    if (immunization.site) {
      const siteStr = formatCodeableConcepts([immunization.site], "Site");
      if (siteStr) {
        parts.push(siteStr);
      }
    }

    if (immunization.route) {
      const routeStr = formatCodeableConcepts([immunization.route], "Route");
      if (routeStr) {
        parts.push(routeStr);
      }
    }

    if (immunization.doseQuantity) {
      const doseStr = formatQuantity(immunization.doseQuantity, "Dose");
      if (doseStr) {
        parts.push(doseStr);
      }
    }

    const performerStr = formatReferences(immunization.performer, "Performer");
    if (performerStr) {
      parts.push(performerStr);
    }

    const notes = formatAnnotations(immunization.note, "Note");
    if (notes) {
      parts.push(notes);
      hasMinimumData = true;
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
