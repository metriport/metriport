export type CwDirectoryEntryData = {
  id: string; // Organization's ID
  organizationName: string;
  organizationId: string;
  orgType: string;
  memberName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string | undefined;
  state: string | undefined;
  zipCode: string | undefined;
  country: string | undefined;
  networks: unknown;
  active: boolean;
  delegateOids?: string[];
};
