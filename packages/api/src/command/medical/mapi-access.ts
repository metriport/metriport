import { sendSecurityNotification } from "@metriport/core/external/slack/index";
import { emptyFunction } from "@metriport/shared";
import NotFoundError from "../../errors/not-found";
import { MAPIAccess } from "../../models/medical/mapi-access";

export async function allowMapiAccess(cxId: string): Promise<"new" | "existing"> {
  const existing = await MAPIAccess.findByPk(cxId);
  if (existing) return "existing";

  await MAPIAccess.create({ id: cxId });

  // intentionally async
  sendSecurityNotification({ subject: `🔑 MAPI access granted to customer: ${cxId}` }).catch(
    emptyFunction
  );

  return "new";
}

export async function hasMapiAccess(cxId: string): Promise<boolean> {
  const existing = await MAPIAccess.findByPk(cxId);
  if (!existing) return false;
  return true;
}

export async function revokeMapiAccess(cxId: string): Promise<void> {
  const existing = await MAPIAccess.findByPk(cxId);
  if (!existing) throw new NotFoundError("Customer not found", undefined, { cxId });
  await existing.destroy();
}
