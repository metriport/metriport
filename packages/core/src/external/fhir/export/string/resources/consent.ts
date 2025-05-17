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
  toString(consent: Consent): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers(consent.identifier);
    if (identifierStr) parts.push(identifierStr);

    if (consent.status) parts.push(`Status: ${consent.status}`);

    const scopeStr = formatCodeableConcept(consent.scope, "Scope");
    if (scopeStr) parts.push(scopeStr);

    const categoryStr = formatCodeableConcepts(consent.category, "Category");
    if (categoryStr) parts.push(categoryStr);

    // if (consent.patient) {
    //   const patientStr = formatReferences([consent.patient], "Patient");
    //   if (patientStr) parts.push(patientStr);
    // }

    if (consent.dateTime) parts.push(`Date: ${consent.dateTime}`);

    const performerStr = formatReferences(consent.performer, "Performer");
    if (performerStr) parts.push(performerStr);

    const orgStr = formatReferences(consent.organization, "Organization");
    if (orgStr) parts.push(orgStr);

    if (consent.sourceAttachment) {
      const attachment = formatAttachment(consent.sourceAttachment);
      if (attachment) {
        parts.push(`Source: ${attachment}`);
        hasMinimumData = true;
      }
    }

    const sourceStr = formatReference(consent.sourceReference, "Source");
    if (sourceStr) parts.push(sourceStr);

    if (consent.policy) {
      const policies = consent.policy
        .map(policy => {
          const components = [
            policy.authority && `Authority: ${policy.authority}`,
            policy.uri && `URI: ${policy.uri}`,
          ].filter(Boolean);
          return components.join(FIELD_SEPARATOR);
        })
        .filter(Boolean);

      if (policies.length > 0) {
        parts.push(`Policies: ${policies.join(FIELD_SEPARATOR)}`);
        hasMinimumData = true;
      }
    }

    const ruleStr = formatCodeableConcept(consent.policyRule, "Policy Rule");
    if (ruleStr) parts.push(ruleStr);

    if (consent.verification) {
      const verifications = consent.verification
        .map((verification: ConsentVerification) => {
          const components = [
            verification.verified && `Verified`,
            formatReference(verification.verifiedWith, "Verified By"),
            verification.verificationDate && `Verification Date: ${verification.verificationDate}`,
          ].filter(Boolean);
          return components.join(FIELD_SEPARATOR);
        })
        .filter(Boolean);
      if (verifications.length > 0) {
        parts.push(`Verifications: ${verifications.join(FIELD_SEPARATOR)}`);
      }
    }

    if (consent.provision) {
      const provision = consent.provision;
      const provisionParts = [];

      if (provision.type) provisionParts.push(`Type: ${provision.type}`);

      const periodStr = formatPeriod(provision.period, "Period");
      if (periodStr) provisionParts.push(periodStr);

      if (provision.actor) {
        const actors = provision.actor
          .map((actor: ConsentProvisionActor) => {
            const components = [
              formatCodeableConcept(actor.role, "Role"),
              formatReference(actor.reference, "Reference"),
            ].filter(Boolean);
            return components.join(FIELD_SEPARATOR);
          })
          .filter(Boolean);
        if (actors.length > 0) {
          provisionParts.push(`Actors: ${actors.join(FIELD_SEPARATOR)}`);
        }
      }

      const actionStr = formatCodeableConcepts(provision.action, "Action");
      if (actionStr) provisionParts.push(actionStr);

      const labels = formatCodings(provision.securityLabel, "Security Labels");
      if (labels) provisionParts.push(labels);

      const purposes = formatCodings(provision.purpose, "Purposes");
      if (purposes) provisionParts.push(purposes);

      const classes = formatCodings(provision.class, "Classes");
      if (classes) provisionParts.push(classes);

      const codeStr = formatCodeableConcepts(provision.code, "Code");
      if (codeStr) provisionParts.push(codeStr);

      const dataPeriodStr = formatPeriod(provision.dataPeriod, "Data Period");
      if (dataPeriodStr) provisionParts.push(dataPeriodStr);

      if (provision.data) {
        const data = provision.data
          .map((d: ConsentProvisionData) => {
            const components = [
              d.meaning && `Meaning: ${d.meaning}`,
              formatReference(d.reference, "Reference"),
            ].filter(Boolean);
            return components.join(FIELD_SEPARATOR);
          })
          .filter(Boolean);
        if (data.length > 0) {
          provisionParts.push(`Data: ${data.join(FIELD_SEPARATOR)}`);
        }
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

      if (provisionParts.length > 0) {
        parts.push(`Provision: ${provisionParts.join(FIELD_SEPARATOR)}`);
        hasMinimumData = true;
      }
    }

    const textStr = formatNarrative(consent.text, "Text");
    if (textStr) parts.push(textStr);

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
