import { Condition, ConditionEvidence, ConditionStage } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAge } from "../shared/age";
import { formatAnnotations } from "../shared/annotation";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatNarrative } from "../shared/narrative";
import { formatPeriod } from "../shared/period";
import { formatRange } from "../shared/range";
import { formatReference, formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Condition resource to a string representation
 */
export class ConditionToString implements FHIRResourceToString<Condition> {
  toString(condition: Condition): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers(condition.identifier);
    if (identifierStr) parts.push(identifierStr);

    if (condition.clinicalStatus) {
      const status = formatCodeableConcepts([condition.clinicalStatus], "Clinical Status");
      if (status) parts.push(status);
    }

    if (condition.verificationStatus) {
      const status = formatCodeableConcepts([condition.verificationStatus], "Verification Status");
      if (status) parts.push(status);
    }

    if (condition.category) {
      const categoryStr = formatCodeableConcepts(condition.category, "Category");
      if (categoryStr) parts.push(categoryStr);
    }

    const severityStr = formatCodeableConcept(condition.severity, "Severity");
    if (severityStr) parts.push(severityStr);

    if (condition.code) {
      const codeStr = formatCodeableConcepts([condition.code], "Code");
      if (codeStr) {
        parts.push(codeStr);
        hasMinimumData = true;
      }
    }

    if (condition.bodySite) {
      const siteStr = formatCodeableConcepts(condition.bodySite, "Body Site");
      if (siteStr) parts.push(siteStr);
    }

    // const subjectStr = formatReference(condition.subject, "Subject");
    // if (subjectStr) {
    //   parts.push(subjectStr);
    //   hasMinimumData = true;
    // }

    const encounterStr = formatReference(condition.encounter, "Encounter");
    if (encounterStr) parts.push(encounterStr);

    if (condition.onsetDateTime) parts.push(`Onset Date: ${condition.onsetDateTime}`);

    const ageStr = formatAge(condition.onsetAge);
    if (ageStr) parts.push(`Onset Age: ${ageStr}`);

    const periodStr = formatPeriod(condition.onsetPeriod, "Onset Period");
    if (periodStr) parts.push(periodStr);

    const rangeStr = formatRange(condition.onsetRange, "Onset Range");
    if (rangeStr) parts.push(rangeStr);

    if (condition.onsetString) parts.push(`Onset: ${condition.onsetString}`);

    if (condition.abatementDateTime) parts.push(`Abatement Date: ${condition.abatementDateTime}`);

    const abatementAgeStr = formatAge(condition.abatementAge);
    if (abatementAgeStr) parts.push(`Abatement Age: ${abatementAgeStr}`);

    const abatementPeriodStr = formatPeriod(condition.abatementPeriod, "Abatement Period");
    if (abatementPeriodStr) parts.push(abatementPeriodStr);

    const abatementRangeStr = formatRange(condition.abatementRange, "Abatement Range");
    if (abatementRangeStr) parts.push(abatementRangeStr);

    if (condition.abatementString) parts.push(`Abatement: ${condition.abatementString}`);

    if (condition.recordedDate) parts.push(`Recorded Date: ${condition.recordedDate}`);

    if (condition.recorder) {
      const recorderStr = formatReferences([condition.recorder], "Recorder");
      if (recorderStr) parts.push(recorderStr);
    }

    if (condition.asserter) {
      const asserterStr = formatReferences([condition.asserter], "Asserter");
      if (asserterStr) parts.push(asserterStr);
    }

    if (condition.stage) {
      const stages = condition.stage
        .map((stage: ConditionStage) => {
          const components = [
            formatCodeableConcept(stage.summary, "Summary"),
            formatReferences(stage.assessment, "Assessment"),
            formatCodeableConcept(stage.type, "Type"),
          ].filter(Boolean);
          return components.join(FIELD_SEPARATOR);
        })
        .filter(Boolean);
      if (stages.length > 0) {
        parts.push(`Stages: ${stages.join(FIELD_SEPARATOR)}`);
      }
    }

    if (condition.evidence) {
      const evidence = condition.evidence
        .map((ev: ConditionEvidence) => {
          const components = [
            formatCodeableConcepts(ev.code, "Code"),
            formatReferences(ev.detail, "Detail"),
          ].filter(Boolean);
          return components.join(FIELD_SEPARATOR);
        })
        .filter(Boolean);
      if (evidence.length > 0) {
        parts.push(`Evidence: ${evidence.join(FIELD_SEPARATOR)}`);
      }
    }

    const notesStr = formatAnnotations(condition.note, "Note");
    if (notesStr) parts.push(notesStr);

    if (condition.text) {
      const textStr = formatNarrative(condition.text, "Text");
      if (textStr) parts.push(textStr);
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
