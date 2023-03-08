import {
  AddressUseCodes,
  Identifier,
  IdentifierUseCodes,
  NameUseCodes,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
} from "@metriport/commonwell-sdk";
import { GenderAtBirth, generalTypes, Patient, PatientData } from "../../models/medical/patient";
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
  const identifier = {
    use: IdentifierUseCodes.usual,
    label: orgName,
    system: oid(orgId),
    key: patient.id,
    assigner: orgName,
  };
  const strongIdentifiers = getStrongIdentifiers(patient.data);
  return {
    identifier: [identifier],
    details: {
      address: [
        {
          use: AddressUseCodes.home,
          zip: patient.data.address.zip,
          state: patient.data.address.state,
          line: [patient.data.address.addressLine1],
          city: patient.data.address.city,
        },
      ],
      name: [
        {
          use: NameUseCodes.usual,
          given: [patient.data.firstName],
          family: [patient.data.lastName],
        },
      ],
      gender: {
        code: genderMapping[patient.data.genderAtBirth],
      },
      birthDate: patient.data.dob,
      ...(strongIdentifiers.length > 0 ? { identifier: strongIdentifiers } : undefined),
    },
  };
}

function getStrongIdentifiers(data: PatientData): Identifier[] {
  return data.personalIdentifiers.map(id => ({
    use: IdentifierUseCodes.usual,
    key: id.value,
    system:
      id.type === "driversLicense" ? driversLicenseURIs[id.state] : identifierSytemByType[id.type],
    period: id.period,
    ...(id.assigner ? { assigner: id.assigner } : undefined),
  }));
}
