import { Address } from "../../models/medical/address";
import { PatientData } from "../../models/medical/patient";
import { andreasDocRefs } from "./sandbox-seed-data-andreas";
import { DataEntry } from "./sandbox-seed-data-defaults";
import { hajraDocRefs } from "./sandbox-seed-data-hajra";
import { janeDocRefs } from "./sandbox-seed-data-jane";
import { kylaDocRefs } from "./sandbox-seed-data-kyla";
import { ollieDocRefs } from "./sandbox-seed-data-ollie";
import { roryDocRefs } from "./sandbox-seed-data-rory";

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

export function getSandboxSeedData(patientKey: string): PatientEntry | undefined {
  const map: Record<string, PatientEntry> = {
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
            state: "AZ",
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
            state: "PA",
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
            state: "MO",
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
            state: "ME",
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
            state: "CA",
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
            state: "IA",
            zip: "51500",
            country: "USA",
          },
        ],
      },
      docRefs: roryDocRefs,
    },
  };
  return map[patientKey.toLowerCase()];
}
