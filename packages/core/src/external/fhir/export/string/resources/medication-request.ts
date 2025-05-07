import { MedicationRequest } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../types";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatIdentifiers } from "../shared/identifier";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatReferences } from "../shared/reference";
import { formatPeriod } from "../shared/period";
import { formatQuantity } from "../shared/quantity";

/**
 * Converts a FHIR MedicationRequest resource to a string representation
 */
export class MedicationRequestToString implements FHIRResourceToString<MedicationRequest> {
  toString(request: MedicationRequest): string {
    const parts: string[] = [];

    // Add identifier
    const identifierStr = formatIdentifiers(request.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add status
    if (request.status) {
      parts.push(`Status: ${request.status}`);
    }

    // Add intent
    if (request.intent) {
      parts.push(`Intent: ${request.intent}`);
    }

    // Add category
    const categoryStr = formatCodeableConcepts(request.category, "Category");
    if (categoryStr) {
      parts.push(categoryStr);
    }

    // Add priority
    if (request.priority) {
      parts.push(`Priority: ${request.priority}`);
    }

    // Add medication
    if (request.medicationCodeableConcept) {
      const medicationStr = formatCodeableConcepts(
        [request.medicationCodeableConcept],
        "Medication"
      );
      if (medicationStr) {
        parts.push(medicationStr);
      }
    } else if (request.medicationReference) {
      const medicationStr = formatReferences([request.medicationReference], "Medication");
      if (medicationStr) {
        parts.push(medicationStr);
      }
    }

    // Add subject
    if (request.subject) {
      const subjectStr = formatReferences([request.subject], "Subject");
      if (subjectStr) {
        parts.push(subjectStr);
      }
    }

    // Add encounter
    if (request.encounter) {
      const encounterStr = formatReferences([request.encounter], "Encounter");
      if (encounterStr) {
        parts.push(encounterStr);
      }
    }

    // Add authored on
    if (request.authoredOn) {
      parts.push(`Authored: ${request.authoredOn}`);
    }

    // Add requester
    if (request.requester) {
      const requesterStr = formatReferences([request.requester], "Requester");
      if (requesterStr) {
        parts.push(requesterStr);
      }
    }

    // Add reason
    const reasonStr = formatCodeableConcepts(request.reasonCode, "Reason");
    if (reasonStr) {
      parts.push(reasonStr);
    }

    // Add course of therapy
    if (request.courseOfTherapyType) {
      const courseStr = formatCodeableConcepts([request.courseOfTherapyType], "Course");
      if (courseStr) {
        parts.push(courseStr);
      }
    }

    // Add dosage instruction
    if (request.dosageInstruction) {
      const dosages = request.dosageInstruction
        .map(dosage => {
          const parts = [];
          if (dosage.text) {
            parts.push(dosage.text);
          }
          if (dosage.timing?.code?.coding?.[0]) {
            const timing = dosage.timing.code.coding[0];
            parts.push(`Timing: ${timing.display ?? timing.code ?? ""}`);
          }
          if (dosage.route) {
            const routeStr = formatCodeableConcepts([dosage.route], "Route");
            if (routeStr) {
              parts.push(routeStr);
            }
          }
          if (dosage.doseAndRate?.[0]) {
            const dose = dosage.doseAndRate[0];
            if (dose.doseRange) {
              const low = dose.doseRange.low?.value ?? "";
              const high = dose.doseRange.high?.value ?? "";
              const unit = dose.doseRange.high?.unit ?? "";
              parts.push(`Dose Range: ${low} - ${high} ${unit}`);
            } else if (dose.doseQuantity) {
              const doseStr = formatQuantity(dose.doseQuantity, "Dose");
              if (doseStr) {
                parts.push(doseStr);
              }
            }
          }
          return parts.filter(Boolean).join(", ");
        })
        .filter(Boolean)
        .join(FIELD_SEPARATOR);
      if (dosages) {
        parts.push(`Dosage: ${dosages}`);
      }
    }

    // Add dispense request
    if (request.dispenseRequest) {
      const dispense = request.dispenseRequest;
      const dispenseParts = [];
      if (dispense.validityPeriod) {
        const validityStr = formatPeriod(dispense.validityPeriod, "Valid");
        if (validityStr) {
          dispenseParts.push(validityStr);
        }
      }
      if (dispense.numberOfRepeatsAllowed) {
        dispenseParts.push(`Repeats: ${dispense.numberOfRepeatsAllowed}`);
      }
      if (dispense.quantity) {
        const quantityStr = formatQuantity(dispense.quantity, "Quantity");
        if (quantityStr) {
          dispenseParts.push(quantityStr);
        }
      }
      if (dispenseParts.length > 0) {
        parts.push(`Dispense: ${dispenseParts.join(", ")}`);
      }
    }

    // Add substitution
    if (request.substitution) {
      const substitution = request.substitution;
      const substitutionParts = [];
      if (substitution.allowedBoolean !== undefined) {
        substitutionParts.push(`Allowed: ${substitution.allowedBoolean}`);
      }
      if (substitution.reason) {
        const reasonStr = formatCodeableConcepts([substitution.reason], "Reason");
        if (reasonStr) {
          substitutionParts.push(reasonStr);
        }
      }
      if (substitutionParts.length > 0) {
        parts.push(`Substitution: ${substitutionParts.join(", ")}`);
      }
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
