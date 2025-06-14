import { Coverage, Identifier } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";
import { PLAN_CODE_NAME } from "../codes";

export function getCoverage(detail: FlatFileDetail): Coverage | undefined {
  if (!detail.planCode) return undefined;

  detail.planNetworkBIN;
  detail.planNetworkGroupId;
  detail.planNetworkPCN;

  const identifier = getCoverageIdentifiers(detail);

  return {
    resourceType: "Coverage",
    status: "active",
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/coverage-type",
          code: detail.planCode,
          display: PLAN_CODE_NAME[detail.planCode],
        },
      ],
    },
    ...(identifier && identifier.length > 0 ? { identifier } : undefined),
  };
}

function getCoverageIdentifiers(detail: FlatFileDetail): Identifier[] {
  const identifiers: Identifier[] = [];
  if (detail.planNetworkBIN) {
    identifiers.push({
      system: "http://terminology.hl7.org/CodeSystem/NCPDPProviderIdentificationNumber",
      value: detail.planNetworkBIN?.toString() ?? "",
    });
  }
  if (detail.ncpdpId) {
    identifiers.push({
      system: "http://terminology.hl7.org/CodeSystem/NCPDPProviderIdentificationNumber",
      value: detail.ncpdpId,
    });
  }
  return identifiers;
}
