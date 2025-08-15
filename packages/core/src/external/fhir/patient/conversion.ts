import {
  ContactPoint,
  Identifier,
  Narrative,
  Patient as FHIRPatient,
  Reference,
} from "@medplum/fhirtypes";
import { USStateForAddress } from "@metriport/shared";
import { Address } from "../../../domain/address";
import { Contact } from "../../../domain/contact";
import { driversLicenseURIs, identifierSytemByType, OID_PREFIX } from "../../../domain/oid";
import {
  createDriversLicensePersonalIdentifier,
  DriversLicense,
  GenderAtBirth as MetriportGender,
  Patient,
  splitName,
} from "../../../domain/patient";
import { isContactType } from "./shared";

export type FhirGender = NonNullable<FHIRPatient["gender"]>;

export type PatientIdAndData = Pick<Patient, "id" | "data">;

const metriportGenderToFhir: Record<MetriportGender, FhirGender> = {
  F: "female",
  M: "male",
  O: "other",
  U: "unknown",
};

const fhirGenderToMetriportGender: Record<FhirGender, MetriportGender> = {
  female: "F",
  male: "M",
  other: "O",
  unknown: "U",
};

export function mapMetriportGenderToFhirGender(k: MetriportGender | undefined): FhirGender {
  if (k === undefined) {
    return "unknown";
  }
  const gender = metriportGenderToFhir[k];
  return gender ? gender : "unknown";
}

export function mapFhirToMetriportGender(gender: FhirGender | undefined): MetriportGender {
  return gender ? fhirGenderToMetriportGender[gender] : "U";
}

export function mapStringMetriportGenderToFhir(k: string | undefined): FhirGender {
  return mapMetriportGenderToFhirGender(k as MetriportGender | undefined);
}

export function mapPatientDataToResource(patient: PatientIdAndData) {
  const identifier = getFhirIdentifersFromPatient(patient);
  const telecom =
    patient.data.contact
      ?.map((contact: Contact) => {
        const telecoms: ContactPoint[] = [];
        for (const type in contact) {
          if (isContactType(type) && contact[type]) {
            const contactValue = contact[type];
            if (contactValue) {
              const contactPoint: ContactPoint = {
                system: type,
                value: contactValue,
              };
              telecoms.push(contactPoint);
            }
          }
        }
        return telecoms;
      })
      .reduce((prev, curr) => prev.concat(curr), []) ?? [];
  const address =
    patient.data.address.map((addr: Address) => {
      const lines = [addr.addressLine1];
      if (addr.addressLine2) lines.push(addr.addressLine2);
      return {
        line: lines,
        city: addr.city,
        state: addr.state,
        postalCode: addr.zip,
        country: addr.country || "USA",
      };
    }) || [];
  const text = getTextFromPatient(patient);
  return {
    resourceType: "Patient" as const,
    id: patient.id,
    ...(identifier.length > 0 ? { identifier } : {}),
    text,
    name: [
      {
        family: patient.data.lastName,
        given: splitName(patient.data.firstName),
      },
    ],
    ...(telecom.length > 0 ? { telecom } : {}),
    gender: mapMetriportGenderToFhirGender(patient.data.genderAtBirth),
    birthDate: patient.data.dob,
    ...(address.length > 0 ? { address } : {}),
  };
}

export function toFHIR(patient: PatientIdAndData): FHIRPatient {
  return mapPatientDataToResource(patient);
}

export function getFhirIdentifersFromPatient(patient: PatientIdAndData): Identifier[] {
  return (patient.data.personalIdentifiers ?? []).map(id => {
    if (id.type === "driversLicense") {
      return driversLicenseToFhirIdentifier(id);
    }
    return { value: id.value, system: identifierSytemByType[id.type] };
  });
}

export function driversLicenseToFhirIdentifier(id: DriversLicense): Identifier {
  return { value: id.value, system: driversLicenseURIs[id.state] };
}
export function fhirIdentifierToDriversLicense(
  id: Pick<Identifier, "system" | "value">
): DriversLicense | undefined {
  const system = id.system;
  const value = id.value;
  const state = Object.entries(driversLicenseURIs).find(
    ([key, value]) => value === system || value.split(OID_PREFIX)[1] === system
  )?.[0];
  if (system && value && state) {
    return createDriversLicensePersonalIdentifier(value, state as USStateForAddress);
  }
  return undefined;
}

/**
 * 'A resource should have narrative for robust management' (defined in
 * http://hl7.org/fhir/StructureDefinition/DomainResource) (Best Practice Recommendation)
 * @returns Narrative with human readable content
 */
export function getTextFromPatient(patient: PatientIdAndData): Narrative {
  return {
    status: "generated",
    div: `<div xmlns="http://www.w3.org/1999/xhtml">${patient.data.firstName} ${patient.data.lastName}</div>`,
  };
}

export function toFHIRSubject(patientId: string): Reference<FHIRPatient> {
  const subject: Reference<FHIRPatient> = {
    reference: `Patient/${patientId}`,
    type: "Patient",
  };
  return subject;
}
