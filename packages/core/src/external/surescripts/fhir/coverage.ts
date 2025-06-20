import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Coverage, Identifier } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getPlanCodeName } from "@metriport/shared/interface/external/surescripts/plan-code";
import { getSurescriptsDataSourceExtension } from "./shared";
import { SurescriptsContext } from "./types";
import { getPatientReference } from "./patient";
import {
  NCPDP_PROVIDER_ID_SYSTEM,
  PLAN_NETWORK_BIN_SYSTEM,
  PLAN_NETWORK_PCN_SYSTEM,
  COVERAGE_TYPE_SYSTEM,
} from "./constants";

export function getCoverage(
  context: SurescriptsContext,
  detail: ResponseDetail
): Coverage | undefined {
  if (!detail.planCode) return undefined;
  const identifier = getCoverageIdentifiers(detail);
  const beneficiary = getPatientReference(context.patient);
  const extension = [getSurescriptsDataSourceExtension()];

  return {
    resourceType: "Coverage",
    status: "active",
    id: uuidv7(),
    beneficiary,
    // TODO: ENG-377 - determine how to add payor reference to bundle based on validated insurance information
    payor: [],
    type: {
      coding: [
        {
          system: COVERAGE_TYPE_SYSTEM,
          code: detail.planCode,
          display: getPlanCodeName(detail.planCode),
        },
      ],
    },
    ...(identifier.length > 0 ? { identifier } : undefined),
    extension,
  };
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
