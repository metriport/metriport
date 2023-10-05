export type PatientDTO = {
  id: string;
  eTag?: string | undefined;
  firstName: string;
  lastName: string;
  dob: string;
  genderAtBirth: string;
  personalIdentifiers?: PersonalIdentifier | undefined;
  facilityIds: string[];
  address: Address | Address[];
  contact?: Contact | Contact[] | undefined;
};

type Address = {
  addressLine1?: string | undefined;
  addressLine2?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  zip: string;
  country: string;
};

type PersonalIdentifier = {
  value: string;
  period:
    | {
        start: string;
        end?: string | undefined;
      }
    | {
        start?: string | undefined;
        end: string;
      }
    | undefined;
  assigner?: string | undefined;
  type?: string | undefined;
  state?: string | undefined;
};

type Contact = {
  phone?: string | undefined;
  email?: string | undefined;
};
