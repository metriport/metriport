export type PatientDTO = {
  id: string;
  eTag?: string;
  firstName: string;
  lastName: string;
  dob: string;
  genderAtBirth: "M" | "F";
  personalIdentifiers?: PersonalIdentifier[];
  facilityIds: string[];
  address: Address | Address[];
  contact?: Contact | Contact[];
};

type Address = {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip: string;
  country: string;
};

type PersonalIdentifier = {
  value: string;
  period?:
    | {
        start: string;
        end?: string;
      }
    | {
        start?: string;
        end: string;
      };
  assigner?: string;
  type: "driversLicense";
  state: string;
};

type Contact = {
  phone?: string | undefined;
  email?: string | undefined;
};
