import { Organization } from "@medplum/fhirtypes";
import { metriportOrganization } from "@metriport/shared";
import { CdaCustodian } from "../../cda-types/shared-types";
import { buildRepresentedOrganization } from "../commons";

export function buildCustodian(organization?: Organization): CdaCustodian {
  const custodian = {
    assignedCustodian: {
      representedCustodianOrganization: organization
        ? buildRepresentedOrganization(organization)
        : buildRepresentedOrganization(metriportOrganization),
    },
  };
  return custodian;
}
