import { Organization } from "@medplum/fhirtypes";

export function getParentOid(org: Organization): string | undefined {
  const parentOrg = org.partOf?.reference ?? org.partOf?.identifier?.value;
  const parentOrgOid = parentOrg?.split("/")[1];
  return parentOrgOid;
}
