import { Coverage } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";

export function parseCoverage(detail: FlatFileDetail): Coverage {
  detail.planCode;
  detail.planNetworkBIN;
  detail.planNetworkGroupId;
  detail.planNetworkPCN;

  return {
    resourceType: "Coverage",
    status: "active",
    type: {
      coding: [
        { system: "http://terminology.hl7.org/CodeSystem/coverage-type", code: "individual" },
      ],
    },
  };
}
