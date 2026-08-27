import { Organization } from "@medplum/fhirtypes";

export type OrganizationWithId = Organization & Required<Pick<Organization, "id">>;
