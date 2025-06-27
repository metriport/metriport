import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Coverage, Organization, Identifier, Reference } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import {
  getSourceOfPaymentCode,
  getSourceOfPaymentName,
} from "@metriport/shared/interface/external/surescripts/payment-code";
import { SurescriptsContext } from "./types";
import { getPatientReference } from "./patient";
import { getSurescriptsDataSourceExtension } from "./shared";
import {
  NCPDP_PROVIDER_ID_SYSTEM,
  PLAN_NETWORK_BIN_SYSTEM,
  PLAN_NETWORK_PCN_SYSTEM,
  SOURCE_OF_PAYMENT_TYPOLOGY_SYSTEM,
} from "./constants";

export function getInsuranceOrganization(detail: ResponseDetail): Organization | undefined {
  const sourceOfPayment = getSourceOfPayment(detail);
  if (!sourceOfPayment) return undefined;
  const extension = [getSurescriptsDataSourceExtension()];

  return {
    resourceType: "Organization",
    id: uuidv7(),
    name: sourceOfPayment.name,
    identifier: [
      {
        system: SOURCE_OF_PAYMENT_TYPOLOGY_SYSTEM,
        value: sourceOfPayment.code,
      },
    ],
    extension,
  };
}

function getInsuranceOrganizationReference(organization: Organization): Reference<Organization> {
  return {
    reference: `Organization/${organization.id}`,
  };
}

export function getCoverage(
  context: SurescriptsContext,
  insuranceOrganization: Organization,
  detail: ResponseDetail
): Coverage | undefined {
  if (!detail.planCode) return undefined;
  const identifier = getCoverageIdentifiers(detail);
  const beneficiary = getPatientReference(context.patient);
  const relationship = getCoverageRelationship(detail);
  const subscriberId = getCoverageSubscriberId(detail);
  const extension = [getSurescriptsDataSourceExtension()];
  const payor = [getInsuranceOrganizationReference(insuranceOrganization)];

  return {
    resourceType: "Coverage",
    status: "active",
    id: uuidv7(),
    beneficiary,
    payor,
    ...(identifier.length > 0 ? { identifier } : undefined),
    ...(relationship ? { relationship } : undefined),
    ...(subscriberId ? { subscriberId } : undefined),
    extension,
  };
}

function getCoverageRelationship(detail: ResponseDetail): Coverage["relationship"] | undefined {
  const sourceOfPayment = getSourceOfPayment(detail);
  if (!sourceOfPayment) return undefined;

  return {
    coding: [
      {
        system: SOURCE_OF_PAYMENT_TYPOLOGY_SYSTEM,
        code: sourceOfPayment.code,
        display: sourceOfPayment.name,
      },
    ],
  };
}

function getCoverageSubscriberId(detail: ResponseDetail): string | undefined {
  if (!detail.insuranceIdNumber) return undefined;
  return detail.insuranceIdNumber;
}

function getCoverageIdentifiers(detail: ResponseDetail): Identifier[] {
  const identifiers: Identifier[] = [];
  if (detail.planNetworkPCN) {
    identifiers.push({
      system: PLAN_NETWORK_PCN_SYSTEM,
      value: detail.planNetworkPCN,
    });
  }
  if (detail.planNetworkBIN) {
    identifiers.push({
      system: PLAN_NETWORK_BIN_SYSTEM,
      value: detail.planNetworkBIN?.toString() ?? "",
    });
  }
  if (detail.ncpdpId) {
    identifiers.push({
      system: NCPDP_PROVIDER_ID_SYSTEM,
      value: detail.ncpdpId,
    });
  }
  return identifiers;
}

function getSourceOfPayment(detail: ResponseDetail): { code: string; name: string } | undefined {
  const paymentCode = detail.paymentCode ?? detail.planCode;
  if (!paymentCode) return undefined;
  const sourceOfPaymentCode = getSourceOfPaymentCode(paymentCode);
  if (!sourceOfPaymentCode) return undefined;
  const sourceOfPaymentName = getSourceOfPaymentName(sourceOfPaymentCode);
  if (!sourceOfPaymentName) return undefined;
  return { code: sourceOfPaymentCode, name: sourceOfPaymentName };
}
