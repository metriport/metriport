import {
  isHealthcareItVendor,
  isProvider,
  Organization,
} from "@metriport/core/domain/organization";
import { BadRequestError } from "@metriport/shared";
import { getOrganizationOrFail } from "../organization/get-organization";

export async function verifyCxAccessToSendFacilityToHies(cxId: string): Promise<boolean>;
export async function verifyCxAccessToSendFacilityToHies(org: Organization): Promise<boolean>;
export async function verifyCxAccessToSendFacilityToHies(
  param: string | Organization
): Promise<boolean> {
  const org = typeof param === "string" ? await getOrganizationOrFail({ cxId: param }) : param;
  if (isHealthcareItVendor(org)) return true;
  throw new BadRequestError("Only IT Vendors can send facilities to HIEs");
}

export async function verifyCxAccessToSendOrgToHies(cxId: string): Promise<boolean>;
export async function verifyCxAccessToSendOrgToHies(org: Organization): Promise<boolean>;
export async function verifyCxAccessToSendOrgToHies(
  param: string | Organization
): Promise<boolean> {
  const org = typeof param === "string" ? await getOrganizationOrFail({ cxId: param }) : param;
  if (isProvider(org)) return true;
  throw new BadRequestError("Only Providers can send organizations to HIEs");
}
