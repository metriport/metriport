import {
  AddressUseCodes,
  Contact,
  ContactSystemCodes,
  GenderCodes,
  Identifier,
  NameUseCodes,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
  StrongId,
} from "@metriport/commonwell-sdk-v1";
import { addOidPrefix, driversLicenseURIs } from "@metriport/core/domain/oid";
import { GenderAtBirth, Patient, splitName } from "@metriport/core/domain/patient";
import { MetriportError, normalizePhoneNumber } from "@metriport/shared";

const genderMapping: { [k in GenderAtBirth]: GenderCodes | undefined } = {
  F: GenderCodes.F,
  M: GenderCodes.M,
  O: GenderCodes.UN,
  U: undefined,
};

export function mapGenderAtBirthToCw(k: GenderAtBirth): GenderCodes | undefined {
  return genderMapping[k];
}

export function makePersonForPatient(cwPatient: CommonwellPatient): CommonwellPerson {
  return {
    details: cwPatient.details,
  };
}

export function patientToCommonwell({
  patient,
  orgName,
  orgOID,
}: {
  patient: Patient;
  orgName: string;
  orgOID: string;
}): CommonwellPatient {
  const identifier: Identifier = {
    use: "usual",
    label: orgName,
    system: addOidPrefix(orgOID),
    key: patient.id,
    assigner: orgName,
  };
  const strongIds = getCwStrongIdsFromPatient(patient);
  const cwGender = mapGenderAtBirthToCw(patient.data.genderAtBirth);
  if (!cwGender)
    throw new MetriportError("Missing gender on patientToCommonwell", undefined, {
      patientId: patient.id,
    });
  let addedAddress = false;
  return {
    identifier: [identifier],
    details: {
      address: patient.data.address.map(address => {
        const line: string[] = [];
        if (address.addressLine1) line.push(address.addressLine1);
        if (address.addressLine2) line.push(address.addressLine2);
        const use = addedAddress ? AddressUseCodes.unspecified : AddressUseCodes.home;
        addedAddress = true;
        return {
          use,
          zip: address.zip,
          state: address.state,
          line,
          city: address.city,
        };
      }),
      name: [
        {
          use: NameUseCodes.usual,
          given: splitName(patient.data.firstName),
          family: splitName(patient.data.lastName),
        },
      ],
      gender: {
        code: cwGender,
      },
      telecom: patient.data.contact?.flatMap(contact => {
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
      }),
      birthDate: patient.data.dob,
      identifier: strongIds,
    },
  };
}

export function getCwStrongIdsFromPatient(patient: Patient): StrongId[] {
  return (patient.data.personalIdentifiers ?? []).flatMap(id => {
    const base = {
      use: "usual" as StrongId["use"],
      period: id.period,
      assigner: id.assigner,
    };
    if (id.type === "driversLicense") {
      return { ...base, key: id.value, system: driversLicenseURIs[id.state] };
    }
    return []; // { ...base, key: id.value, system: identifierSytemByType[id.type] }
  });
}
