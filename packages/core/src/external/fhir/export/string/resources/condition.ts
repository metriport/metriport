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
  toString(condition: Condition, isDebug?: boolean): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: condition.identifier });
    if (identifierStr) parts.push(identifierStr);

    const status = formatCodeableConcept({
      concept: condition.clinicalStatus,
      label: "Clinical Status",
      isDebug,
    });
    if (status) parts.push(status);

    const verificationStatusStr = formatCodeableConcept({
      concept: condition.verificationStatus,
      label: "Verification Status",
      isDebug,
    });
    if (verificationStatusStr) parts.push(verificationStatusStr);

    const categoryStr = formatCodeableConcepts({
      concepts: condition.category,
      label: "Category",
      isDebug,
    });
    if (categoryStr) parts.push(categoryStr);

    const severityStr = formatCodeableConcept({
      concept: condition.severity,
      label: "Severity",
      isDebug,
    });
    if (severityStr) parts.push(severityStr);

    const codeStr = formatCodeableConcept({
      concept: condition.code,
      label: "Code",
      isDebug,
    });
    if (codeStr) {
      parts.push(codeStr);
      hasMinimumData = true;
    }

    const siteStr = formatCodeableConcepts({
      concepts: condition.bodySite,
      label: "Body Site",
      isDebug,
    });
    if (siteStr) parts.push(siteStr);

    // const subjectStr = formatReference(condition.subject, "Subject");
    // if (subjectStr) {
    //   parts.push(subjectStr);
    //   hasMinimumData = true;
    // }

    const encounterStr = formatReference({
      reference: condition.encounter,
      label: "Encounter",
      isDebug,
    });
    if (encounterStr) parts.push(encounterStr);

    if (condition.onsetDateTime) {
      parts.push(isDebug ? `Onset Date: ${condition.onsetDateTime}` : condition.onsetDateTime);
    }

    const ageStr = formatAge({ age: condition.onsetAge, isDebug });
    if (ageStr) parts.push(isDebug ? `Onset Age: ${ageStr}` : ageStr);

    const periodStr = formatPeriod({
      period: condition.onsetPeriod,
      label: "Onset Period",
      isDebug,
    });
    if (periodStr) parts.push(periodStr);

    const rangeStr = formatRange({ range: condition.onsetRange, label: "Onset Range", isDebug });
    if (rangeStr) parts.push(rangeStr);

    if (condition.onsetString) {
      parts.push(isDebug ? `Onset: ${condition.onsetString}` : condition.onsetString);
    }

    if (condition.abatementDateTime) {
      parts.push(
        isDebug ? `Abatement Date: ${condition.abatementDateTime}` : condition.abatementDateTime
      );
    }

    const abatementAgeStr = formatAge({ age: condition.abatementAge, isDebug });
    if (abatementAgeStr) {
      parts.push(isDebug ? `Abatement Age: ${abatementAgeStr}` : abatementAgeStr);
    }

    const abatementPeriodStr = formatPeriod({
      period: condition.abatementPeriod,
      label: "Abatement Period",
      isDebug,
    });
    if (abatementPeriodStr) parts.push(abatementPeriodStr);

    const abatementRangeStr = formatRange({
      range: condition.abatementRange,
      label: "Abatement Range",
      isDebug,
    });
    if (abatementRangeStr) parts.push(abatementRangeStr);

    if (condition.abatementString) {
      parts.push(isDebug ? `Abatement: ${condition.abatementString}` : condition.abatementString);
    }

    if (condition.recordedDate) {
      parts.push(isDebug ? `Recorded Date: ${condition.recordedDate}` : condition.recordedDate);
    }

    const recorderStr = formatReference({
      reference: condition.recorder,
      label: "Recorder",
      isDebug,
    });
    if (recorderStr) parts.push(recorderStr);

    const asserterStr = formatReference({
      reference: condition.asserter,
      label: "Asserter",
      isDebug,
    });
    if (asserterStr) parts.push(asserterStr);

    const stages = condition.stage
      ?.map((stage: ConditionStage) => {
        const components = [
          formatCodeableConcept({ concept: stage.summary, label: "Summary", isDebug }),
          formatReferences({ references: stage.assessment, label: "Assessment", isDebug }),
          formatCodeableConcept({ concept: stage.type, label: "Type", isDebug }),
        ].filter(Boolean);
        return components.join(FIELD_SEPARATOR);
      })
      .filter(Boolean);
    if (stages && stages.length > 0) {
      const stagesStr = stages.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Stages: ${stagesStr}` : stagesStr);
    }

    const evidence = condition.evidence
      ?.map((ev: ConditionEvidence) => {
        const components = [
          formatCodeableConcepts({ concepts: ev.code, label: "Code", isDebug }),
          formatReferences({ references: ev.detail, label: "Detail", isDebug }),
        ].filter(Boolean);
        return components.join(FIELD_SEPARATOR);
      })
      .filter(Boolean);
    if (evidence && evidence.length > 0) {
      const evidenceStr = evidence.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Evidence: ${evidenceStr}` : evidenceStr);
    }

    const notesStr = formatAnnotations({ annotations: condition.note, label: "Note", isDebug });
    if (notesStr) parts.push(notesStr);

    if (condition.text) {
      const textStr = formatNarrative({ narrative: condition.text, label: "Text", isDebug });
      if (textStr) parts.push(textStr);
    }

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
