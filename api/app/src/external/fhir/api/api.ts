import { MedplumClient } from "@medplum/core";

//eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FhirClient extends MedplumClient {}

export interface FhirAdminClient {
  createTenant(org: { organizationNumber: number; cxId: string }): Promise<void>;
  listTenants(): Promise<string[]>;
  deleteTenant(org: { organizationNumber: number }): Promise<void>;
}
