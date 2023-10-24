import { seedData as coreSeedData } from "@metriport/core/src/domain/seed/seed-data";
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
    ...coreSeedData.jane,
    docRefs: janeDocRefs,
  },
  ollie: {
    ...coreSeedData.ollie,
    docRefs: ollieDocRefs,
  },
  andreas: {
    ...coreSeedData.andreas,
    docRefs: andreasDocRefs,
  },
  kyla: {
    ...coreSeedData.kyla,
    docRefs: kylaDocRefs,
  },
  hajra: {
    ...coreSeedData.hajra,
    docRefs: hajraDocRefs,
  },
  rory: {
    ...coreSeedData.rory,
    docRefs: roryDocRefs,
  },
  lexi: {
    ...coreSeedData.lexi,
    docRefs: lexiDocRefs,
  },
  aamina: {
    ...coreSeedData.aamina,
    docRefs: aaminaDocRefs,
  },
  gavin: {
    ...coreSeedData.gavin,
    docRefs: gavinDocRefs,
  },
  william: {
    ...coreSeedData.william,
    docRefs: williamDocRefs,
  },
  wanda: {
    ...coreSeedData.wanda,
    docRefs: wandaDocRefs,
  },
  damien: {
    ...coreSeedData.damien,
    docRefs: damienDocRefs,
  },
  emilia: {
    ...coreSeedData.emilia,
    docRefs: emiliaDocRefs,
  },
  heather: {
    ...coreSeedData.heather,
    docRefs: heatherDocRefs,
  },
};
export function getSandboxSeedData(patientKey: string): PatientEntry | undefined {
  return seedData[patientKey.toLowerCase()];
}
