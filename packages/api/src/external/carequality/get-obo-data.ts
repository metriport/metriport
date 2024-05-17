import BadRequestError from "@metriport/core/util/error/bad-request";
import NotFoundError from "@metriport/core/util/error/not-found";
import { getCqOrganization } from "./command/cq-directory/create-or-update-cq-organization";

export type CqOboDetails =
  | {
      enabled: true;
      cqFacilityName: string;
      cqOboOid: string;
    }
  | {
      enabled: false;
    };

export async function getCqOboData(
  cqActive?: boolean | null,
  cqOboOid?: string | null
): Promise<CqOboDetails> {
  if (cqActive && cqOboOid) {
    const cqFacilityName = await getCqFacilityName(cqOboOid);
    return {
      enabled: true,
      cqFacilityName,
      cqOboOid,
    };
  }
  return { enabled: false };
}

export async function getCqFacilityName(oid: string): Promise<string> {
  const existingFacility = await getCqOrganization(oid);
  if (!existingFacility) {
    throw new BadRequestError("CQ OBO organization with the specified CQ OBO OID was not found");
  }
  const existingFacilityName = existingFacility.name?.value;
  if (!existingFacilityName) throw new NotFoundError("CQ OBO organization has no name");
  return existingFacilityName;
}
