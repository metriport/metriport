import {
  ContactPoint,
  DocumentReference,
  Identifier,
  Patient as FHIRPatient,
  Reference,
} from "@medplum/fhirtypes";
import { Address } from "../../../domain/address";
import { Contact, ContactTypes } from "../../../domain/contact";
import { driversLicenseURIs, identifierSytemByType } from "../../../domain/oid";
import { GenderAtBirth as MetriportGender, Patient, splitName } from "../../../domain/patient";
import { getIdFromSubjectId, getIdFromSubjectRef } from "../shared";
import { IheGender } from "../../carequality/ihe-gateway-v2/outbound/xcpd/process/schema";

type FhirGender = NonNullable<FHIRPatient["gender"]>;

export type PatientIdAndData = Pick<Patient, "id" | "data">;

const iheGenderToFhirGender: Record<IheGender, FhirGender> = {
  F: "female",
  M: "male",
  UN: "other",
  UNK: "unknown",
};

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

const fhirGenderToIheGender: Record<FhirGender, IheGender> = {
  female: "F",
  male: "M",
  other: "UN",
  unknown: "UNK",
};

export function mapIheGenderToFhir(k: IheGender | undefined): FhirGender {
  if (k === undefined) {
    return "unknown";
  }
  const gender = iheGenderToFhirGender[k];
  return gender ? gender : "unknown";
}

export function mapFhirToIheGender(gender: FhirGender): IheGender {
  const iheGender = fhirGenderToIheGender[gender];
  return iheGender ? iheGender : "UNK";
}

export function mapMetriportGenderToFhirGender(k: MetriportGender | undefined): FhirGender {
  if (k === undefined) {
    return "unknown";
  }
  const gender = metriportGenderToFhir[k];
  return gender ? gender : "unknown";
}

export function mapFhirToMetriportGender(gender: FhirGender): MetriportGender {
  const MetriportGender = fhirGenderToMetriportGender[gender];
  return MetriportGender ? MetriportGender : "U";
}

export function mapStringMetriportGenderToFhir(k: string): FhirGender {
  return mapMetriportGenderToFhirGender(k as MetriportGender);
}

export function mapPatientDataToResource(patient: PatientIdAndData) {
  return {
    resourceType: "Patient" as const,
    id: patient.id,
    identifier: getFhirIdentifersFromPatient(patient),
    name: [
      {
        family: patient.data.lastName,
        given: splitName(patient.data.firstName),
      },
    ],
    telecom:
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
        .reduce((prev, curr) => prev.concat(curr), []) || [],
    gender: mapMetriportGenderToFhirGender(patient.data.genderAtBirth),
    birthDate: patient.data.dob,
    address:
      patient.data.address.map((addr: Address) => {
        return {
          line: addr.addressLine1 ? [addr.addressLine1] : [],
          city: addr.city,
          state: addr.state,
          postalCode: addr.zip,
          country: addr.country || "USA",
        };
      }) || [],
  };
}

export function toFHIR(patient: PatientIdAndData): FHIRPatient {
  return mapPatientDataToResource(patient);
}

export function getFhirIdentifersFromPatient(patient: PatientIdAndData): Identifier[] {
  return (patient.data.personalIdentifiers ?? []).map(id => {
    if (id.type === "driversLicense") {
      return { value: id.value, system: driversLicenseURIs[id.state] };
    }
    return { value: id.value, system: identifierSytemByType[id.type] };
  });
}

export function toFHIRSubject(patientId: string): Reference<FHIRPatient> {
  const subject: Reference<FHIRPatient> = {
    reference: `Patient/${patientId}`,
    type: "Patient",
  };
  return subject;
}

export function getPatientId(doc: DocumentReference): string | undefined {
  return getIdFromSubjectId(doc.subject) ?? getIdFromSubjectRef(doc.subject);
}

export function isContactType(type: string): type is ContactTypes {
  return ["phone", "fax", "email", "pager", "url", "sms", "other"].includes(type);
}
