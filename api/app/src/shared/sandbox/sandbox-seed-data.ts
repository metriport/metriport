import { DocumentReference } from "@medplum/fhirtypes";
import { Address } from "../../models/medical/address";
import { PatientData } from "../../models/medical/patient";
import { Config } from "../config";

const bucket = Config.getSandboxBucketName();

export function patientMatches(patient: PatientData): boolean {
  const seedData = getSandboxSeedData(patient.firstName);
  for (const seed of seedData) {
    const demo = seed.demographics;
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
  }
  return false;
}

type DemographicsOnDataEntry = Pick<
  PatientData,
  "firstName" | "lastName" | "dob" | "genderAtBirth" | "address"
>;
export type DataEntry = {
  demographics: DemographicsOnDataEntry;
  docRef: DocumentReference;
  s3Info: { bucket: string; key: string };
};

export function getSandboxSeedData(patientKey: string): DataEntry[] {
  const map: Record<string, DataEntry[]> = {
    john: [
      {
        // TODO Replace this with the actual doc ref
        demographics: {
          firstName: "",
          lastName: "",
          dob: "",
          genderAtBirth: "M",
          address: [
            {
              addressLine1: "",
              addressLine2: "",
              city: "",
              state: "",
              zip: "",
              country: "",
            },
          ],
        },
        docRef: {} as DocumentReference,
        s3Info: { bucket, key: "john.json" },
      },
    ],
  };
  return map[patientKey] ?? [];
}
