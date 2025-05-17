import { Coverage } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatNarrative } from "../shared/narrative";
import { formatPeriod } from "../shared/period";
import { formatQuantity } from "../shared/quantity";
import { formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Coverage resource to a string representation
 */
export class CoverageToString implements FHIRResourceToString<Coverage> {
  toString(coverage: Coverage): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers(coverage.identifier);
    if (identifierStr) parts.push(identifierStr);

    if (coverage.status) {
      parts.push(`Status: ${coverage.status}`);
    }

    if (coverage.type) {
      const typeStr = formatCodeableConcepts([coverage.type], "Type");
      if (typeStr) parts.push(typeStr);
    }

    if (coverage.policyHolder) {
      const policyHolderStr = formatReferences([coverage.policyHolder], "Policy Holder");
      if (policyHolderStr) parts.push(policyHolderStr);
    }

    if (coverage.subscriber) {
      const subscriberStr = formatReferences([coverage.subscriber], "Subscriber");
      if (subscriberStr) parts.push(subscriberStr);
    }

    if (coverage.beneficiary) {
      const beneficiaryStr = formatReferences([coverage.beneficiary], "Beneficiary");
      if (beneficiaryStr) parts.push(beneficiaryStr);
    }

    if (coverage.dependent) parts.push(`Dependent: ${coverage.dependent}`);

    // if (coverage.subscriberId) parts.push(`Subscriber ID: ${coverage.subscriberId}`);
    // if (coverage.order) parts.push(`Order: ${coverage.order}`);
    // if (coverage.network) parts.push(`Network: ${coverage.network}`);
    // if (coverage.subrogation) parts.push(`Subrogation: ${coverage.subrogation}`);

    if (coverage.relationship) {
      const relationshipStr = formatCodeableConcepts([coverage.relationship], "Relationship");
      if (relationshipStr) parts.push(relationshipStr);
    }

    if (coverage.period) {
      const periodStr = formatPeriod(coverage.period, "Period");
      if (periodStr) parts.push(periodStr);
    }

    if (coverage.payor) {
      const payorStr = formatReferences(coverage.payor, "Payor");
      if (payorStr) parts.push(payorStr);
    }

    if (coverage.class) {
      const classes = coverage.class
        .map(cls => {
          const type = cls.type ? formatCodeableConcepts([cls.type], "Type") : undefined;
          const value = cls.value ? `Value: ${cls.value}` : undefined;
          const name = cls.name ? `Name: ${cls.name}` : undefined;
          return [type, value, name].filter(Boolean).join(FIELD_SEPARATOR);
        })
        .filter(Boolean);

      if (classes.length > 0) {
        parts.push(`Classes: ${classes.join(FIELD_SEPARATOR)}`);
        hasMinimumData = true;
      }
    }

    if (coverage.costToBeneficiary) {
      const costs = coverage.costToBeneficiary
        .map(cost => {
          const components = [
            cost.type && formatCodeableConcepts([cost.type], "Type"),
            cost.valueQuantity && formatQuantity(cost.valueQuantity, "Value"),
            cost.valueMoney && `Value: ${cost.valueMoney.value} ${cost.valueMoney.currency}`,
            cost.exception &&
              cost.exception
                .map(ex => {
                  const exComponents = [
                    formatCodeableConcept(ex.type, "Type"),
                    formatPeriod(ex.period, "Period"),
                  ].filter(Boolean);
                  return exComponents.length > 0
                    ? `Exception: ${exComponents.join(FIELD_SEPARATOR)}`
                    : undefined;
                })
                .filter(Boolean)
                .join(FIELD_SEPARATOR),
          ].filter(Boolean);
          return components.join(FIELD_SEPARATOR);
        })
        .filter(Boolean);

      if (costs.length > 0) {
        parts.push(`Costs: ${costs.join(FIELD_SEPARATOR)}`);
        hasMinimumData = true;
      }
    }

    if (coverage.contract) {
      const contractStr = formatReferences(coverage.contract, "Contract");
      if (contractStr) parts.push(contractStr);
    }

    const textStr = formatNarrative(coverage.text, "Text");
    if (textStr) parts.push(textStr);

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
