import {
  AddressUseCodes,
  Contact,
  ContactSystemCodes,
  Identifier,
  NameUseCodes,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
} from "@metriport/commonwell-sdk";
import {
  driversLicenseURIs,
  medicareURI,
  addOidPrefix,
  passportURI,
  ssnURI,
} from "@metriport/core/domain/oid";
import {
  GenderAtBirth,
  generalTypes,
  Patient,
  PatientData,
  splitName,
} from "@metriport/core/domain/patient";

export const genderMapping: { [k in GenderAtBirth]: string } = {
  F: "F",
  M: "M",
};

export const identifierSytemByType: Record<(typeof generalTypes)[number], string> = {
  ssn: ssnURI,
  passport: passportURI,
  medicare: medicareURI,
};

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
  const strongIdentifiers = getStrongIdentifiers(patient.data);
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
        code: genderMapping[patient.data.genderAtBirth],
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
      identifier: strongIdentifiers,
    },
  };
}

function getStrongIdentifiers(data: PatientData): Identifier[] | undefined {
  return data.personalIdentifiers?.map(id => ({
    use: "usual",
    key: id.value,
    system:
      id.type === "driversLicense" ? driversLicenseURIs[id.state] : identifierSytemByType[id.type],
    period: id.period,
    ...(id.assigner ? { assigner: id.assigner } : undefined),
  }));
}

function normalizePhoneNumber(phone: string): string {
  const numericPhone = phone.replace(/[^0-9]/g, "");
  if (numericPhone.length > 10) {
    return numericPhone.slice(-10);
  }
  return numericPhone;
}
