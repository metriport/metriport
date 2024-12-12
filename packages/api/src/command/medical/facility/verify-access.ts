import {
  isHealthcareItVendor,
  isProvider,
  Organization,
} from "@metriport/core/domain/organization";
import ForbiddenError from "../../../errors/forbidden";
import { getOrganizationOrFail } from "../organization/get-organization";

export async function verifyCxItVendorAccess(cxId: string): Promise<boolean>;
export async function verifyCxItVendorAccess(org: Organization): Promise<boolean>;
export async function verifyCxItVendorAccess(param: string | Organization): Promise<boolean> {
  const org = typeof param === "string" ? await getOrganizationOrFail({ cxId: param }) : param;
  if (isHealthcareItVendor(org)) return true;
  throw new ForbiddenError("Facilities cannot be created or updated, contact support.");
}

export async function verifyCxProviderAccess(cxId: string): Promise<boolean>;
export async function verifyCxProviderAccess(org: Organization): Promise<boolean>;
export async function verifyCxProviderAccess(param: string | Organization): Promise<boolean> {
  const org = typeof param === "string" ? await getOrganizationOrFail({ cxId: param }) : param;
  if (isProvider(org)) return true;
  throw new ForbiddenError("Facilities cannot be created or updated, contact support.");
}
