import { FamilyMemberHistory, FamilyMemberHistoryCondition } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcepts } from "../shared/codeable-concept";
import { formatPeriod } from "../shared/period";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR FamilyMemberHistory resource to a string representation
 */
export class FamilyMemberHistoryToString implements FHIRResourceToString<FamilyMemberHistory> {
  toString(history: FamilyMemberHistory): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    // const identifierStr = formatIdentifiers(history.identifier);
    // if (identifierStr) parts.push(identifierStr);

    if (history.status) {
      parts.push(`Status: ${history.status}`);
    }

    // if (history.patient) {
    //   const patientStr = formatReferences([history.patient], "Patient");
    //   if (patientStr) parts.push(patientStr);
    // }

    if (history.date) {
      parts.push(`Date: ${history.date}`);
    }

    if (history.name) {
      parts.push(`Name: ${history.name}`);
      hasMinimumData = true;
    }

    if (history.relationship) {
      const relationshipStr = formatCodeableConcepts([history.relationship], "Relationship");
      if (relationshipStr) {
        parts.push(relationshipStr);
        hasMinimumData = true;
      }
    }

    if (history.sex) {
      const sexStr = formatCodeableConcepts([history.sex], "Sex");
      if (sexStr) parts.push(sexStr);
    }

    if (history.bornPeriod) {
      const bornStr = formatPeriod(history.bornPeriod, "Born");
      if (bornStr) parts.push(bornStr);
    } else if (history.bornDate) {
      parts.push(`Born: ${history.bornDate}`);
    } else if (history.bornString) {
      parts.push(`Born: ${history.bornString}`);
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
      parts.push(`Deceased`);
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

    const notes = formatAnnotations(history.note, "Note");
    if (notes) {
      parts.push(notes);
      hasMinimumData = true;
    }

    if (history.condition) {
      const conditions = history.condition
        .map((condition: FamilyMemberHistoryCondition) => {
          const code = condition.code
            ? formatCodeableConcepts([condition.code], "Condition")
            : undefined;
          const outcome = condition.outcome
            ? formatCodeableConcepts([condition.outcome], "Outcome")
            : undefined;
          const notes = formatAnnotations(condition.note, "Note");
          const onset = condition.onsetAge?.value
            ? `Onset Age: ${condition.onsetAge.value} ${condition.onsetAge.unit}`
            : undefined;
          return [code, outcome, onset, notes].filter(Boolean).join(FIELD_SEPARATOR);
        })
        .filter(Boolean);

      if (conditions.length > 0) {
        parts.push(`Conditions: ${conditions.join(FIELD_SEPARATOR)}`);
        hasMinimumData = true;
      }
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
