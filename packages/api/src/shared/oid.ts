import { OIDNode } from "@metriport/core/domain/oid";
import { Config } from "./config";

export function makeOrganizationOID(orgNumber: string | number): string {
  return `${Config.getSystemRootOID()}.${OIDNode.organizations}.${orgNumber}`;
}
