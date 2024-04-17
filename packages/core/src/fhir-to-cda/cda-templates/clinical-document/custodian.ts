import { MetriportOrganization } from "@metriport/shared";
import { buildRepresentedOrganization } from "../commons";
import { CDACustodian } from "../../cda-types/shared-types";

export function buildCustodian(): CDACustodian | undefined {
  const custodian = {
    assignedCustodian: {
      representedCustodianOrganization: buildRepresentedOrganization(MetriportOrganization),
    },
  };
  return custodian;
}
