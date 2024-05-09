import {
  AddressUseCodes,
  Contact,
  ContactSystemCodes,
  Identifier,
  NameUseCodes,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
  StrongId,
} from "@metriport/commonwell-sdk";
import { addOidPrefix, driversLicenseURIs } from "@metriport/core/domain/oid";
import { Patient, splitName, genderAtBirthMapping } from "@metriport/core/domain/patient";

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
        code: genderAtBirthMapping[patient.data.genderAtBirth],
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
      ...(id.period ? { period: id.period } : undefined),
      ...(id.assigner ? { assigner: id.assigner } : undefined),
    };
    if (id.type === "driversLicense")
      return { ...base, key: id.value, system: driversLicenseURIs[id.state] };
    return []; // { ...base, key: id.value, system: identifierSytemByType[id.type] }
  });
}

function normalizePhoneNumber(phone: string): string {
  const numericPhone = phone.replace(/[^0-9]/g, "");
  if (numericPhone.length > 10) {
    return numericPhone.slice(-10);
  }
  return numericPhone;
}
