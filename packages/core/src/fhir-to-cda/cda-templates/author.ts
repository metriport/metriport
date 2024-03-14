import { Organization } from "@medplum/fhirtypes";
import { withNullFlavorObject } from "./utils";
import { constructAddress, constructRepresentedOrganization } from "./commons";

export function constructAuthor(organization: Organization): unknown {
  const author = {
    assignedAuthor: {
      id: withNullFlavorObject(organization.id, "@_root"),
      addr: constructAddress(organization.address),
      telecom: organization.telecom?.map(telecom => ({
        ...withNullFlavorObject(telecom.use, "@_use"),
        ...withNullFlavorObject(telecom.value, "@_value"),
      })),
      representedOrganization: constructRepresentedOrganization(organization),
    },
  };
  return author;
}
