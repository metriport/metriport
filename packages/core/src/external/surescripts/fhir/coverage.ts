import { Coverage, Identifier } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { PlanCodeName } from "@metriport/shared/interface/external/surescripts/plan-code";

export function getCoverage(detail: ResponseDetail): Coverage | undefined {
  if (!detail.planCode) return undefined;

  // detail.planNetworkBIN;
  // detail.planNetworkGroupId;
  // detail.planNetworkPCN;

  const identifier = getCoverageIdentifiers(detail);

  return {
    resourceType: "Coverage",
    status: "active",
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/coverage-type",
          code: detail.planCode,
          display: PlanCodeName[detail.planCode],
        },
      ],
    },
    ...(identifier && identifier.length > 0 ? { identifier } : undefined),
  };
}

function getCoverageIdentifiers(detail: ResponseDetail): Identifier[] {
  const identifiers: Identifier[] = [];
  if (detail.planNetworkPCN) {
    identifiers.push({
      system: "http://terminology.hl7.org/CodeSystem/v2-0203",
      value: detail.planNetworkPCN,
    });
  }
  // detail.planNetworkGroupId;
  // detail.planNetworkPCN;

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
