import { metriportOrganization } from "@metriport/shared";
import { buildRepresentedOrganization } from "../commons";
import { CDACustodian } from "../../cda-types/shared-types";

export function buildCustodian(): CDACustodian {
  const custodian = {
    assignedCustodian: {
      representedCustodianOrganization: buildRepresentedOrganization(metriportOrganization),
    },
  };
  return custodian;
}
