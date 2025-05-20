import { FamilyMemberHistory, FamilyMemberHistoryCondition } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAge } from "../shared/age";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatPeriod } from "../shared/period";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR FamilyMemberHistory resource to a string representation
 */
export class FamilyMemberHistoryToString implements FHIRResourceToString<FamilyMemberHistory> {
  toString(history: FamilyMemberHistory, isDebug?: boolean): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    // const identifierStr = formatIdentifiers(history.identifier);
    // if (identifierStr) parts.push(identifierStr);

    if (history.status) {
      parts.push(isDebug ? `Status: ${history.status}` : history.status);
    }

    // if (history.patient) {
    //   const patientStr = formatReferences({ references: [history.patient], label: "Patient", isDebug });
    //   if (patientStr) parts.push(patientStr);
    // }

    if (history.date) {
      parts.push(isDebug ? `Date: ${history.date}` : history.date);
    }

    if (history.name) {
      parts.push(isDebug ? `Name: ${history.name}` : history.name);
      hasMinimumData = true;
    }

    if (history.relationship) {
      const relationshipStr = formatCodeableConcepts({
        concepts: [history.relationship],
        label: "Relationship",
        isDebug,
      });
      if (relationshipStr) {
        parts.push(relationshipStr);
        hasMinimumData = true;
      }
    }

    if (history.sex) {
      const sexStr = formatCodeableConcepts({ concepts: [history.sex], label: "Sex", isDebug });
      if (sexStr) parts.push(sexStr);
    }

    if (history.bornPeriod) {
      const bornStr = formatPeriod({ period: history.bornPeriod, label: "Born", isDebug });
      if (bornStr) parts.push(bornStr);
    } else if (history.bornDate) {
      parts.push(isDebug ? `Born: ${history.bornDate}` : history.bornDate);
    } else if (history.bornString) {
      parts.push(isDebug ? `Born: ${history.bornString}` : history.bornString);
    }

    // if (history.ageAge) {
    //   parts.push(`Age: ${history.ageAge.value} ${history.ageAge.unit}`);
    // } else if (history.ageRange) {
    //   const ageStr = formatPeriod(history.ageRange, "Age Range");
    //   if (ageStr) parts.push(ageStr);
    // } else if (history.ageString) {
    //   parts.push(`Age: ${history.ageString}`);
    // }

    if (history.deceasedBoolean) {
      parts.push("Deceased");
    }
    // } else if (history.deceasedAge) {
    //   parts.push(`Deceased Age: ${history.deceasedAge.value} ${history.deceasedAge.unit}`);
    // } else if (history.deceasedRange) {
    //   const deceasedStr = formatPeriod(history.deceasedRange, "Deceased Range");
    //   if (deceasedStr) parts.push(deceasedStr);
    // } else if (history.deceasedDate) {
    //   parts.push(`Deceased Date: ${history.deceasedDate}`);
    // } else if (history.deceasedString) {
    //   parts.push(`Deceased: ${history.deceasedString}`);
    // }

    const notes = formatAnnotations({ annotations: history.note, label: "Note", isDebug });
    if (notes) {
      parts.push(notes);
      hasMinimumData = true;
    }

    const conditions = history.condition
      ?.map((condition: FamilyMemberHistoryCondition) => {
        const code = formatCodeableConcept({
          concept: condition.code,
          label: "Condition",
          isDebug,
        });
        const outcome = formatCodeableConcept({
          concept: condition.outcome,
          label: "Outcome",
          isDebug,
        });
        const notes = formatAnnotations({ annotations: condition.note, label: "Note", isDebug });
        const onset = formatAge({ age: condition.onsetAge, label: "Onset", isDebug });
        return [code, outcome, onset, notes].filter(Boolean).join(FIELD_SEPARATOR);
      })
      .filter(Boolean);
    if (conditions && conditions.length > 0) {
      const conditionsStr = conditions.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Conditions: ${conditionsStr}` : conditionsStr);
      hasMinimumData = true;
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
