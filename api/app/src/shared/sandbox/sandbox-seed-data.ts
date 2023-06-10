import { Address } from "../../models/medical/address";
import { PatientData } from "../../models/medical/patient";
import { DataEntry } from "./sandbox-seed-data-defaults";
import { janeDocRefs } from "./sandbox-seed-data-jane";
import { ollieDocRefs } from "./sandbox-seed-data-ollie";

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
    // heather: {
    //   demographics: {
    //     firstName: "Heather",
    //     lastName: "Alverez",
    //     dob: "1939-11-01",
    //     genderAtBirth: "F",
    //     address: [
    //       {
    //         addressLine1: "670 9th Ave",
    //         city: "Harrisburg",
    //         state: "PA",
    //         zip: "15300",
    //         country: "USA",
    //       },
    //     ],
    //   },
    //   docRefs: heatherDocRefs,
    // },
    // kyla: {
    //   demographics: {
    //     firstName: "Kyla",
    //     lastName: "Fields",
    //     dob: "1927-05-23",
    //     genderAtBirth: "F",
    //     address: [
    //       {
    //         addressLine1: "332 16th St",
    //         city: "Portland",
    //         state: "ME",
    //         zip: "04000",
    //         country: "USA",
    //       },
    //     ],
    //   },
    //   docRefs: kylaDocRefs,
    // },
  };
  return map[patientKey.toLowerCase()];
}
