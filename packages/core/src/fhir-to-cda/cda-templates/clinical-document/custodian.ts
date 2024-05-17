import { metriportOrganization } from "@metriport/shared";
import { buildRepresentedOrganization } from "../commons";
import { CdaCustodian } from "../../cda-types/shared-types";

export function buildCustodian(): CdaCustodian {
  const custodian = {
    assignedCustodian: {
      representedCustodianOrganization: buildRepresentedOrganization(metriportOrganization),
    },
  };
  return custodian;
}
