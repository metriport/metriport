import { Coverage } from "@medplum/fhirtypes";
import { defaultHasMinimumData, FHIRResourceToString } from "../fhir-resource-to-string";
import { formatCodeableConcept, formatCodeableConcepts } from "../shared/codeable-concept";
import { formatIdentifiers } from "../shared/identifier";
import { formatNarrative } from "../shared/narrative";
import { formatPeriod } from "../shared/period";
import { formatQuantity } from "../shared/quantity";
import { formatReference, formatReferences } from "../shared/reference";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Coverage resource to a string representation
 */
export class CoverageToString implements FHIRResourceToString<Coverage> {
  toString(coverage: Coverage, isDebug?: boolean): string | undefined {
    let hasMinimumData = defaultHasMinimumData;
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: coverage.identifier });
    if (identifierStr) parts.push(identifierStr);

    if (coverage.status) {
      parts.push(isDebug ? `Status: ${coverage.status}` : coverage.status);
    }

    if (coverage.type) {
      const typeStr = formatCodeableConcepts({ concepts: [coverage.type], label: "Type", isDebug });
      if (typeStr) parts.push(typeStr);
    }

    const policyHolderStr = formatReference({
      reference: coverage.policyHolder,
      label: "Policy Holder",
      isDebug,
    });
    if (policyHolderStr) parts.push(policyHolderStr);

    const subscriberStr = formatReference({
      reference: coverage.subscriber,
      label: "Subscriber",
      isDebug,
    });
    if (subscriberStr) parts.push(subscriberStr);

    const beneficiaryStr = formatReference({
      reference: coverage.beneficiary,
      label: "Beneficiary",
      isDebug,
    });
    if (beneficiaryStr) parts.push(beneficiaryStr);

    if (coverage.dependent) {
      parts.push(isDebug ? `Dependent: ${coverage.dependent}` : coverage.dependent);
    }

    // if (coverage.subscriberId) parts.push(`Subscriber ID: ${coverage.subscriberId}`);
    // if (coverage.order) parts.push(`Order: ${coverage.order}`);
    // if (coverage.network) parts.push(`Network: ${coverage.network}`);
    // if (coverage.subrogation) parts.push(`Subrogation: ${coverage.subrogation}`);

    if (coverage.relationship) {
      const relationshipStr = formatCodeableConcepts({
        concepts: [coverage.relationship],
        label: "Relationship",
        isDebug,
      });
      if (relationshipStr) parts.push(relationshipStr);
    }

    if (coverage.period) {
      const periodStr = formatPeriod({ period: coverage.period, label: "Period", isDebug });
      if (periodStr) parts.push(periodStr);
    }

    if (coverage.payor) {
      const payorStr = formatReferences({ references: coverage.payor, label: "Payor", isDebug });
      if (payorStr) parts.push(payorStr);
    }

    const classes = coverage.class
      ?.map(cls => {
        const type = cls.type
          ? formatCodeableConcept({ concept: cls.type, label: "Type", isDebug })
          : undefined;
        const value = cls.value ? (isDebug ? `Value: ${cls.value}` : cls.value) : undefined;
        const name = cls.name ? (isDebug ? `Name: ${cls.name}` : cls.name) : undefined;
        return [type, value, name].filter(Boolean).join(FIELD_SEPARATOR);
      })
      .filter(Boolean);

    if (classes && classes.length > 0) {
      const classesStr = classes.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Classes: ${classesStr}` : classesStr);
      hasMinimumData = true;
    }

    const costs = coverage.costToBeneficiary
      ?.map(cost => {
        const { type, valueQuantity, valueMoney, exception } = cost;
        const components = [
          type && formatCodeableConcept({ concept: type, label: "Type", isDebug }),
          valueQuantity && formatQuantity({ quantity: valueQuantity, label: "Value", isDebug }),
          valueMoney &&
            (isDebug
              ? `Value: ${valueMoney.value} ${valueMoney.currency}`
              : `${valueMoney.value} ${valueMoney.currency}`),
          exception &&
            exception
              .map(ex => {
                const exComponents = [
                  formatCodeableConcept({ concept: ex.type, label: "Type", isDebug }),
                  formatPeriod({ period: ex.period, label: "Period", isDebug }),
                ].filter(Boolean);
                const exStr = exComponents.join(FIELD_SEPARATOR);
                return exStr.length > 0 ? (isDebug ? `Exception: ${exStr}` : exStr) : undefined;
              })
              .filter(Boolean)
              .join(FIELD_SEPARATOR),
        ].filter(Boolean);
        return components.join(FIELD_SEPARATOR);
      })
      .filter(Boolean);
    if (costs && costs.length > 0) {
      const costsStr = costs.join(FIELD_SEPARATOR);
      parts.push(isDebug ? `Costs: ${costsStr}` : costsStr);
      hasMinimumData = true;
    }

    const contractStr = formatReferences({
      references: coverage.contract,
      label: "Contract",
      isDebug,
    });
    if (contractStr) parts.push(contractStr);

    const textStr = formatNarrative({ narrative: coverage.text, label: "Text", isDebug });
    if (textStr) parts.push(textStr);

    if (!hasMinimumData) return undefined;

    return parts.join(FIELD_SEPARATOR);
  }
}
