import { Address } from "@metriport/core/domain/address";
import { PatientData } from "@metriport/core/domain/patient";
import { andreasDocRefs } from "./sandbox-seed-data-andreas";
import { DataEntry } from "./sandbox-seed-data-defaults";
import { chrisDocRefs } from "./sandbox-seed-data-chris";
import { janeDocRefs } from "./sandbox-seed-data-jane";
import { kylaDocRefs } from "./sandbox-seed-data-kyla";
import { ollieDocRefs } from "./sandbox-seed-data-ollie";
import { USState } from "@metriport/shared";

export function patientMatches(patient: PatientData): boolean {
  const patientData = getSandboxSeedData(patient.firstName);
  if (!patientData) return false;

  const demo = patientData.demographics;
  const check = (prop: keyof DemographicsOnDataEntry): boolean => {
    return demo[prop] === patient[prop];
  };
  const checkAddresses = (): boolean => {
    for (const addrDemo of demo.address) {
      for (const addrPat of patient.address) {
        const checkAddr = (prop: keyof Address): boolean => {
          return addrDemo[prop] === addrPat[prop];
        };
        if (
          checkAddr("addressLine1") &&
          checkAddr("addressLine2") &&
          checkAddr("city") &&
          checkAddr("state") &&
          checkAddr("zip") &&
          checkAddr("state") &&
          checkAddr("country")
        ) {
          return true;
        }
      }
    }
    return false;
  };
  if (
    check("firstName") &&
    check("lastName") &&
    check("dob") &&
    check("genderAtBirth") &&
    demo.address.length === patient.address.length &&
    checkAddresses()
  ) {
    return true;
  }
  return false;
}

type DemographicsOnDataEntry = Pick<
  PatientData,
  "firstName" | "lastName" | "dob" | "genderAtBirth" | "address"
>;

export type PatientEntry = { demographics: DemographicsOnDataEntry; docRefs: DataEntry[] };

export const seedData: Record<string, PatientEntry> = {
  chris: {
    demographics: {
      firstName: "Chris",
      lastName: "Smith",
      dob: "1995-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Atlantis Rd",
          city: "Chicago",
          state: USState.IL,
          zip: "12345",
          country: "USA",
        },
      ],
    },
    docRefs: chrisDocRefs,
  },
  jane: {
    demographics: {
      firstName: "Jane",
      lastName: "Smith",
      dob: "1996-02-10",
      genderAtBirth: "F",
      address: [
        {
          addressLine1: "123 Arsenal St",
          city: "Phoenix",
          state: USState.AZ,
          zip: "85300",
          country: "USA",
        },
      ],
    },
    docRefs: janeDocRefs,
  },
  ollie: {
    demographics: {
      firstName: "Ollie",
      lastName: "Brown",
      dob: "1946-03-18",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "201 Armada St",
          city: "Harrisburg",
          state: USState.PA,
          zip: "15300",
          country: "USA",
        },
      ],
    },
    docRefs: ollieDocRefs,
  },
  andreas: {
    demographics: {
      firstName: "Andreas",
      lastName: "Sims",
      dob: "1952-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "4430 York St",
          city: "Jefferson City",
          state: USState.MO,
          zip: "64000",
          country: "USA",
        },
      ],
    },
    docRefs: andreasDocRefs,
  },
  kyla: {
    demographics: {
      firstName: "Kyla",
      lastName: "Fields",
      dob: "1927-05-23",
      genderAtBirth: "F",
      address: [
        {
          addressLine1: "332 16th St",
          city: "Portland",
          state: USState.ME,
          zip: "04000",
          country: "USA",
        },
      ],
    },
    docRefs: kylaDocRefs,
  },
};
export function getSandboxSeedData(patientKey: string): PatientEntry | undefined {
  return seedData[patientKey.toLowerCase()];
}
