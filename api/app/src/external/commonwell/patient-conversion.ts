import {
  AddressUseCodes,
  Identifier,
  NameUseCodes,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
} from "@metriport/commonwell-sdk";
import {
  GenderAtBirth,
  generalTypes,
  Patient,
  PatientData,
  splitName,
} from "../../models/medical/patient";
import { driversLicenseURIs, medicareURI, oid, passportURI, ssnURI } from "../../shared/oid";

export const genderMapping: { [k in GenderAtBirth]: string } = {
  F: "F",
  M: "M",
};

const identifierSytemByType: Record<(typeof generalTypes)[number], string> = {
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
  orgId,
}: {
  patient: Patient;
  orgName: string;
  orgId: string;
}): CommonwellPatient {
  const identifier: Identifier = {
    use: "usual",
    label: orgName,
    system: oid(orgId),
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
