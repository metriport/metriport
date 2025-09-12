import {
  AddressUseCodes,
  Contact,
  ContactSystemCodes,
  GenderCodes,
  NameUseCodes,
  Patient as CommonwellPatient,
  PatientIdentifier,
} from "@metriport/commonwell-sdk";
import { driversLicenseURIs, identifierSytemByType } from "@metriport/core/domain/oid";
import { GenderAtBirth, Patient, splitName } from "@metriport/core/domain/patient";
import { MetriportError, normalizePhoneNumber } from "@metriport/shared";

const genderMapping: { [k in GenderAtBirth]: GenderCodes | undefined } = {
  F: GenderCodes.F,
  M: GenderCodes.M,
  O: GenderCodes.O,
  U: GenderCodes.U,
};

export function patientToCommonwell({
  patient,
  orgName,
  orgOID,
}: {
  patient: Patient;
  orgName: string;
  orgOID: string;
}): CommonwellPatient {
  const identifier: PatientIdentifier = {
    use: "usual",
    system: orgOID,
    value: patient.id,
    assigner: orgName,
  };
  const strongIds = getCwStrongIdsFromPatient(patient);
  const cwGender = mapGenderAtBirthToCw(patient.data.genderAtBirth);
  if (!cwGender) {
    throw new MetriportError("Missing gender on patientToCommonwell", undefined, {
      patientId: patient.id,
      gender: patient.data.genderAtBirth,
    });
  }
  return {
    active: true,
    managingOrganization: {
      identifier: [{ system: orgOID }],
      name: orgName,
    },
    identifier: [identifier, ...strongIds],
    name: [
      {
        use: NameUseCodes.usual,
        given: splitName(patient.data.firstName),
        family: splitName(patient.data.lastName),
      },
    ],
    gender: cwGender,
    birthDate: patient.data.dob,
    address: patient.data.address.map(address => {
      const line: string[] = [];
      if (address.addressLine1) line.push(address.addressLine1);
      if (address.addressLine2) line.push(address.addressLine2);
      return {
        line,
        postalCode: normalizePostalCode(address.zip),
        city: address.city,
        state: address.state,
        use: AddressUseCodes.home,
      };
    }),
    telecom:
      patient.data.contact?.flatMap(contact => {
        const contacts: Contact[] = [];
        if (contact.email) {
          contacts.push({
            system: ContactSystemCodes.email,
            value: contact.email,
          });
        }
        if (contact.phone) {
          contacts.push({
            system: ContactSystemCodes.phone,
            value: normalizePhoneNumber(contact.phone),
          });
        }
        return contacts;
      }) ?? [],
  };
}

function normalizePostalCode(zip: string): string | undefined {
  if (zip === "00000") return undefined;
  return zip;
}

function mapGenderAtBirthToCw(k: GenderAtBirth): GenderCodes | undefined {
  return genderMapping[k];
}

function getCwStrongIdsFromPatient(patient: Patient): PatientIdentifier[] {
  return (patient.data.personalIdentifiers ?? []).flatMap(id => {
    const base: Omit<PatientIdentifier, "value" | "system"> = {
      use: "official",
      period: id.period,
      assigner: id.assigner,
    };
    if (id.type === "driversLicense") {
      const dlSystem = id.state ? driversLicenseURIs[id.state] : undefined;
      if (!dlSystem) return [];
      return { ...base, value: id.value, type: "DL", system: dlSystem };
    }
    const system = identifierSytemByType[id.type];
    if (!system) return [];
    return { ...base, type: "SS", value: id.value, system };
  });
}
