import NotFoundError from "../../errors/not-found";
import { createTenantSafe } from "../../external/fhir/admin";
import { MAPIAccess } from "../../models/medical/mapi-access";
import { getOrganizationOrFail } from "./organization/get-organization";

export async function allowMapiAccess(cxId: string): Promise<"new" | "existing"> {
  const existing = await MAPIAccess.findByPk(cxId);
  if (existing) return "existing";

  // give access to MAPI
  await MAPIAccess.create({ id: cxId });

  // create tenant on FHIR server
  const org = await getOrganizationOrFail({ cxId });
  await createTenantSafe(org);

  return "new";
}

export async function revokeMapiAccess(cxId: string): Promise<void> {
  const existing = await MAPIAccess.findByPk(cxId);
  if (!existing) throw new NotFoundError("Customer not found");
  await existing.destroy();
}
