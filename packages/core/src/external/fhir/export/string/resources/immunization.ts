import { Immunization } from "@medplum/fhirtypes";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { checkDeny } from "../shared/deny";
import { formatIdentifiers } from "../shared/identifier";
import { formatQuantity } from "../shared/quantity";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";
import { FHIRResourceToString } from "../types";

/**
 * Converts a FHIR Immunization resource to a string representation
 */
export class ImmunizationToString implements FHIRResourceToString<Immunization> {
  toString(immunization: Immunization): string | undefined {
    const parts: string[] = [];

    // Add identifier
    const identifierStr = formatIdentifiers(immunization.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add status
    if (immunization.status) {
      parts.push(`Status: ${immunization.status}`);
    }

    // Add vaccine code
    if (immunization.vaccineCode) {
      const codeStr = formatCodeableConcepts([immunization.vaccineCode], "Vaccine");
      if (codeStr) {
        parts.push(codeStr);
      }
    }

    // Add occurrence
    if (immunization.occurrenceDateTime) {
      parts.push(`Occurrence: ${immunization.occurrenceDateTime}`);
    }

    // Add primary source
    if (immunization.primarySource !== undefined) {
      parts.push(`Primary Source: ${immunization.primarySource}`);
    }

    // Add manufacturer
    if (immunization.manufacturer) {
      const manufacturerStr = formatReferences([immunization.manufacturer], "Manufacturer");
      if (manufacturerStr) {
        parts.push(manufacturerStr);
      }
    }

    // Add lot number
    if (immunization.lotNumber) {
      const lotNumber = checkDeny(immunization.lotNumber);
      if (lotNumber) {
        parts.push(`Lot Number: ${lotNumber}`);
      }
    }

    // Add expiration date
    if (immunization.expirationDate) {
      parts.push(`Expiration: ${immunization.expirationDate}`);
    }

    // Add site
    if (immunization.site) {
      const siteStr = formatCodeableConcepts([immunization.site], "Site");
      if (siteStr) {
        parts.push(siteStr);
      }
    }

    // Add route
    if (immunization.route) {
      const routeStr = formatCodeableConcepts([immunization.route], "Route");
      if (routeStr) {
        parts.push(routeStr);
      }
    }

    // Add dose quantity
    if (immunization.doseQuantity) {
      const doseStr = formatQuantity(immunization.doseQuantity, "Dose");
      if (doseStr) {
        parts.push(doseStr);
      }
    }

    // Add performer
    const performerStr = formatReferences(immunization.performer, "Performer");
    if (performerStr) {
      parts.push(performerStr);
    }

    // Add note
    if (immunization.note) {
      const notes = immunization.note
        .map(note => note.text)
        .filter(Boolean)
        .join(FIELD_SEPARATOR);
      if (notes) {
        parts.push(`Note: ${notes}`);
      }
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
