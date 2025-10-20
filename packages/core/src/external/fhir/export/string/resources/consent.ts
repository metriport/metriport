import {
  Consent,
  ConsentProvisionActor,
  ConsentProvisionData,
  ConsentVerification,
} from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAttachment } from "../shared/attachment";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatCodings } from "../shared/coding";
import { formatIdentifiers } from "../shared/identifier";
import { formatNarrative } from "../shared/narrative";
import { formatPeriod } from "../shared/period";
import { formatReference, formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Consent resource to a string representation
 */
export class ConsentToString implements FHIRResourceToString<Consent> {
  toString(consent: Consent, isDebug?: boolean): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: consent.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (consent.status) parts.push(isDebug ? `Status: ${consent.status}` : consent.status);

    const scopeStr = formatCodeableConcept({ concept: consent.scope, label: "Scope", isDebug });
    if (scopeStr) parts.push(scopeStr);

    const categoryStr = formatCodeableConcepts({
      concepts: consent.category,
      label: "Category",
      isDebug,
    });
    if (categoryStr) parts.push(categoryStr);

    // if (consent.patient) {
    //   const patientStr = formatReferences([consent.patient], "Patient");
    //   if (patientStr) parts.push(patientStr);
    // }

    if (consent.dateTime) parts.push(isDebug ? `Date: ${consent.dateTime}` : consent.dateTime);

    const performerStr = formatReferences({
      references: consent.performer,
      label: "Performer",
      isDebug,
    });
    if (performerStr) parts.push(performerStr);

    const orgStr = formatReferences({
      references: consent.organization,
      label: "Organization",
      isDebug,
    });
    if (orgStr) parts.push(orgStr);

    const attachment = formatAttachment({
      attachment: consent.sourceAttachment,
      label: "Source",
      isDebug,
    });
    if (attachment) {
      parts.push(isDebug ? `Source: ${attachment}` : attachment);
      hasMinimumData = true;
    }

    const sourceStr = formatReference({
      reference: consent.sourceReference,
      label: "Source",
      isDebug,
    });
    if (sourceStr) parts.push(sourceStr);

    const policies = consent.policy
      ?.map(policy => {
        const components = [
          policy.authority && (isDebug ? `Authority: ${policy.authority}` : policy.authority),
          policy.uri && (isDebug ? `URI: ${policy.uri}` : policy.uri),
        ].filter(Boolean);
        return components.join(FIELD_SEPARATOR);
      })
      .filter(Boolean);
    if (policies && policies.length > 0) {
      const policiesStr = policies.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Policies: ${policiesStr}` : policiesStr);
      hasMinimumData = true;
    }

    const ruleStr = formatCodeableConcept({
      concept: consent.policyRule,
      label: "Policy Rule",
      isDebug,
    });
    if (ruleStr) parts.push(ruleStr);

    const verifications = consent.verification
      ?.map((verification: ConsentVerification) => {
        const components = [
          verification.verified && "Verified",
          formatReference({
            reference: verification.verifiedWith,
            label: "Verified By",
            isDebug,
          }),
          verification.verificationDate &&
            (isDebug
              ? `Verification Date: ${verification.verificationDate}`
              : verification.verificationDate),
        ].filter(Boolean);
        return components.join(FIELD_SEPARATOR);
      })
      .filter(Boolean);
    if (verifications && verifications.length > 0) {
      const verificationsStr = verifications.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Verifications: ${verificationsStr}` : verificationsStr);
    }

    if (consent.provision) {
      const provision = consent.provision;
      const provisionParts = [];

      if (provision.type) provisionParts.push(isDebug ? `Type: ${provision.type}` : provision.type);

      const periodStr = formatPeriod({ period: provision.period, label: "Period", isDebug });
      if (periodStr) provisionParts.push(periodStr);

      const actors = provision.actor
        ?.map((actor: ConsentProvisionActor) => {
          const components = [
            formatCodeableConcept({ concept: actor.role, label: "Role", isDebug }),
            formatReference({ reference: actor.reference, label: "Reference", isDebug }),
          ].filter(Boolean);
          return components.join(FIELD_SEPARATOR);
        })
        .filter(Boolean);
      if (actors && actors.length > 0) {
        const actorsStr = actors.join(FIELD_SEPARATOR);
        provisionParts.push(isDebug ? `Actors: ${actorsStr}` : actorsStr);
      }

      const actionStr = formatCodeableConcepts({
        concepts: provision.action,
        label: "Action",
        isDebug,
      });
      if (actionStr) provisionParts.push(actionStr);

      const labels = formatCodings({
        codings: provision.securityLabel,
        label: "Security Labels",
        isDebug,
      });
      if (labels) provisionParts.push(labels);

      const purposes = formatCodings({ codings: provision.purpose, label: "Purposes", isDebug });
      if (purposes) provisionParts.push(purposes);

      const classes = formatCodings({ codings: provision.class, label: "Classes", isDebug });
      if (classes) provisionParts.push(classes);

      const codeStr = formatCodeableConcepts({ concepts: provision.code, label: "Code", isDebug });
      if (codeStr) provisionParts.push(codeStr);

      const dataPeriodStr = formatPeriod({
        period: provision.dataPeriod,
        label: "Data Period",
        isDebug,
      });
      if (dataPeriodStr) provisionParts.push(dataPeriodStr);

      const data = provision.data
        ?.map((d: ConsentProvisionData) => {
          const components = [
            d.meaning && (isDebug ? `Meaning: ${d.meaning}` : d.meaning),
            formatReference({ reference: d.reference, label: "Data Reference", isDebug }),
          ].filter(Boolean);
          return components.join(FIELD_SEPARATOR);
        })
        .filter(Boolean);
      if (data && data.length > 0) {
        const dataStr = data.join(FIELD_SEPARATOR);
        provisionParts.push(isDebug ? `Data: ${dataStr}` : dataStr);
      }

      // if (provision.provision) {
      //   const subProvisions = provision.provision
      //     .map(subProvision => {
      //       const components = [
      //         subProvision.type && `Type: ${subProvision.type}`,
      //         subProvision.period && formatPeriod(subProvision.period, "Period"),
      //         subProvision.code && formatCodeableConcepts(subProvision.code, "Code"),
      //       ].filter(Boolean);
      //       return components.join(FIELD_SEPARATOR);
      //     })
      //     .filter(Boolean);

      //   if (subProvisions.length > 0) {
      //     provisionParts.push(`Sub-provisions: ${subProvisions.join(FIELD_SEPARATOR)}`);
      //   }
      // }

      if (provisionParts && provisionParts.length > 0) {
        const provisionStr = provisionParts.join(FIELD_SEPARATOR);
        parts.push(isDebug ? `Provision: ${provisionStr}` : provisionStr);
        hasMinimumData = true;
      }
    }

    const textStr = formatNarrative({ narrative: consent.text, label: "Text", isDebug });
    if (textStr) parts.push(textStr);

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
