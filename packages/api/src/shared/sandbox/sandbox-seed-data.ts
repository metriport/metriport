import { Address } from "../../domain/medical/address";
import { PatientData } from "../../domain/medical/patient";
import { aaminaDocRefs } from "./sandbox-seed-data-aamina";
import { andreasDocRefs } from "./sandbox-seed-data-andreas";
import { damienDocRefs } from "./sandbox-seed-data-damien";
import { DataEntry } from "./sandbox-seed-data-defaults";
import { emiliaDocRefs } from "./sandbox-seed-data-emilia";
import { gavinDocRefs } from "./sandbox-seed-data-gavin";
import { hajraDocRefs } from "./sandbox-seed-data-hajra";
import { heatherDocRefs } from "./sandbox-seed-data-heather";
import { janeDocRefs } from "./sandbox-seed-data-jane";
import { kylaDocRefs } from "./sandbox-seed-data-kyla";
import { lexiDocRefs } from "./sandbox-seed-data-lexi";
import { ollieDocRefs } from "./sandbox-seed-data-ollie";
import { roryDocRefs } from "./sandbox-seed-data-rory";
import { wandaDocRefs } from "./sandbox-seed-data-wanda";
import { williamDocRefs } from "./sandbox-seed-data-william";
import { USState } from "@metriport/api-sdk";

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
  hajra: {
    demographics: {
      firstName: "Hajra",
      lastName: "Powers",
      dob: "2001-04-04",
      genderAtBirth: "F",
      address: [
        {
          addressLine1: "1984 Juniper Way",
          city: "Sacramento",
          state: USState.CA,
          zip: "95300",
          country: "USA",
        },
      ],
    },
    docRefs: hajraDocRefs,
  },
  rory: {
    demographics: {
      firstName: "Rory",
      lastName: "Mills",
      dob: "1959-09-09",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "891 E. Galvin Court",
          city: "Ames",
          state: USState.IA,
          zip: "51500",
          country: "USA",
        },
      ],
    },
    docRefs: roryDocRefs,
  },
  lexi: {
    demographics: {
      firstName: "Lexi",
      lastName: "Stevenson",
      dob: "1928-03-26",
      genderAtBirth: "F",
      address: [
        {
          addressLine1: "85 Hillside Street",
          city: "Springfield",
          state: USState.IL,
          zip: "62600",
          country: "USA",
        },
      ],
    },
    docRefs: lexiDocRefs,
  },
  aamina: {
    demographics: {
      firstName: "Aamina",
      lastName: "Alexander",
      dob: "1954-10-01",
      genderAtBirth: "F",
      address: [
        {
          addressLine1: "796 Thorne Lane",
          city: "Austin",
          state: USState.TX,
          zip: "75400",
          country: "USA",
        },
      ],
    },
    docRefs: aaminaDocRefs,
  },
  gavin: {
    demographics: {
      firstName: "Gavin",
      lastName: "Blackwell",
      dob: "1948-05-10",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "7028 Stillwater Street",
          city: "Tallahassee",
          state: USState.FL,
          zip: "34600",
          country: "USA",
        },
      ],
    },
    docRefs: gavinDocRefs,
  },
  william: {
    demographics: {
      firstName: "William",
      lastName: "Donovan",
      dob: "1955-09-14",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "7362 Canterbury Street",
          city: "New Orleans",
          state: USState.LA,
          zip: "71200",
          country: "USA",
        },
      ],
    },
    docRefs: williamDocRefs,
  },
  wanda: {
    demographics: {
      firstName: "Wanda",
      lastName: "Walsh",
      dob: "1941-02-19",
      genderAtBirth: "F",
      address: [
        {
          addressLine1: "7517 Cooper Street",
          city: "Santa Fe",
          state: USState.NM,
          zip: "87400",
          country: "USA",
        },
      ],
    },
    docRefs: wandaDocRefs,
  },
  damien: {
    demographics: {
      firstName: "Damien",
      lastName: "Jensen",
      dob: "1964-08-23",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "1440 Mallard Dr",
          city: "Springfield",
          state: USState.IL,
          zip: "61200",
          country: "USA",
        },
      ],
    },
    docRefs: damienDocRefs,
  },
  emilia: {
    demographics: {
      firstName: "Emelia",
      lastName: "Crane",
      dob: "1944-07-30",
      genderAtBirth: "F",
      address: [
        {
          addressLine1: "9366 Piper Street",
          city: "Denver",
          state: USState.CO,
          zip: "81300",
          country: "USA",
        },
      ],
    },
    docRefs: emiliaDocRefs,
  },
  heather: {
    demographics: {
      firstName: "Heather",
      lastName: "Alverez",
      dob: "1939-11-01",
      genderAtBirth: "F",
      address: [
        {
          addressLine1: "670 9th Ave",
          city: "Harrisburg",
          state: USState.PA,
          zip: "15300",
          country: "USA",
        },
      ],
    },
    docRefs: heatherDocRefs,
  },
};
export function getSandboxSeedData(patientKey: string): PatientEntry | undefined {
  return seedData[patientKey.toLowerCase()];
}
