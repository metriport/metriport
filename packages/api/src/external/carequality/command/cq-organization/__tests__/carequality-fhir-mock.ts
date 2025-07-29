import { APIMode, CarequalityManagementApiFhir } from "@metriport/carequality-sdk";
import {
  ListOrganizationsParams,
  OrganizationWithId,
} from "@metriport/carequality-sdk/client/carequality";
import { getApiMode } from "./shared";

export class CarequalityManagementApiFhirMock extends CarequalityManagementApiFhir {
  constructor(params: {
    apiKey: string;
    apiMode: APIMode;
    options?: { timeout?: number; retries?: number; maxBackoff?: number };
  }) {
    super(params);
  }

  override async getOrganization(oid: string): Promise<OrganizationWithId | undefined> {
    return super.getOrganization(oid);
  }

  override async listOrganizations(
    params?: ListOrganizationsParams
  ): Promise<OrganizationWithId[]> {
    return super.listOrganizations(params);
  }

  override async registerOrganization(org: OrganizationWithId): Promise<OrganizationWithId> {
    if (getApiMode() === APIMode.production) {
      throw new Error("registerOrganization cannot be run in production");
    } else {
      return super.registerOrganization(org);
    }
  }

  override async updateOrganization(org: OrganizationWithId): Promise<OrganizationWithId> {
    if (getApiMode() === APIMode.production) {
      throw new Error("updateOrganization cannot be run in production");
    } else {
      return super.updateOrganization(org);
    }
  }

  override async deleteOrganization(oid: string): Promise<OrganizationWithId>;
  override async deleteOrganization(org: OrganizationWithId): Promise<OrganizationWithId>;
  override async deleteOrganization(
    oidOrOrg: string | OrganizationWithId
  ): Promise<OrganizationWithId> {
    if (getApiMode() === APIMode.production) {
      throw new Error("deleteOrganization cannot be run in production");
    }
    if (typeof oidOrOrg === "string") {
      return super.deleteOrganization(oidOrOrg);
    }
    return super.deleteOrganization(oidOrOrg);
  }
}
