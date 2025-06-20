import { Immunization } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
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

    if (immunization.isSubpotent !== undefined) {
      parts.push(`is subpotent: ${immunization.isSubpotent}`);
    }

    const programEligibilityStr = formatCodeableConcepts({
      concepts: immunization.programEligibility,
      label: "Program Eligibility",
      isDebug,
    });
    if (programEligibilityStr) {
      parts.push(programEligibilityStr);
    }

    const fundingSourceStr = formatCodeableConcept({
      concept: immunization.fundingSource,
      label: "Funding Source",
      isDebug,
    });
    if (fundingSourceStr) {
      parts.push(fundingSourceStr);
    }

    if (immunization.reaction) {
      const reactions = immunization.reaction
        .map(reaction => {
          const components = [
            reaction.date && (isDebug ? `Date: ${reaction.date}` : reaction.date),
            formatCodeableConcept({ concept: reaction.detail, label: "Detail", isDebug }),
            // reaction.reported !== undefined &&
            //   (isDebug ? `Reported: ${reaction.reported}` : String(reaction.reported)),
          ].filter(Boolean);
          return components.join(FIELD_SEPARATOR);
        })
        .filter(Boolean);
      if (reactions.length > 0) {
        const reactionsStr = reactions.join(FIELD_SEPARATOR);
        parts.push(isDebug ? `Reactions: ${reactionsStr}` : reactionsStr);
      }
    }

    if (immunization.protocolApplied) {
      const protocols = immunization.protocolApplied
        .map(protocol => {
          const components = [
            protocol.series && (isDebug ? `Series: ${protocol.series}` : protocol.series),
            // protocol.doseNumberPositiveInt !== undefined &&
            //   (isDebug
            //     ? `Dose Number: ${protocol.doseNumberPositiveInt}`
            //     : String(protocol.doseNumberPositiveInt)),
            // protocol.seriesDosesPositiveInt !== undefined &&
            //   (isDebug
            //     ? `Series Doses: ${protocol.seriesDosesPositiveInt}`
            //     : String(protocol.seriesDosesPositiveInt)),
          ].filter(Boolean);
          return components.join(FIELD_SEPARATOR);
        })
        .filter(Boolean);
      if (protocols.length > 0) {
        const protocolsStr = protocols.join(FIELD_SEPARATOR);
        parts.push(isDebug ? `Protocols: ${protocolsStr}` : protocolsStr);
      }
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
