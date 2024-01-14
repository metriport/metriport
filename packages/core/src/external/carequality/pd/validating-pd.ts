import {
  Address as FHIRAddress,
  ContactPoint,
  Identifier,
  Patient as FHIRPatient,
} from "@medplum/fhirtypes";
import { getStateEnum, USState } from "../../../domain/geographic-locations";
import { Address } from "../../../domain/address";
import { Contact } from "../../../domain/contact";
import { PatientData, PersonalIdentifier } from "../../../domain/patient";
import { isContactType } from "../../fhir/patient/index";
import { MetriportError } from "../../../util/error/metriport-error";
import status from "http-status";

export class IHEGatewayError extends MetriportError {
  constructor(
    message: string,
    cause?: unknown,
    public iheErrorCode?: string,
    statusCode: number = status.INTERNAL_SERVER_ERROR
  ) {
    super(message, cause);
    this.name = this.constructor.name;
    this.status = statusCode;
  }
}

export class PatientAddressRequestedError extends IHEGatewayError {
  constructor(message = "Address Line 1 is not defined", cause?: unknown) {
    super(message, cause, "1.3.6.1.4.1.19376.1.2.27.1");
    this.name = this.constructor.name;
  }
}

export class LivingSubjectAdministrativeGenderRequestedError extends IHEGatewayError {
  constructor(message = "Gender at Birth is not defined", cause?: unknown) {
    super(message, cause, "1.3.6.1.4.1.19376.1.2.27.2");
    this.name = this.constructor.name;
  }
}

export class XDSRegistryError extends IHEGatewayError {
  constructor(message = "Internal Server Error", cause?: unknown) {
    super(message, cause, "1.3.6.1.4.1.19376.1.2.27.3", status.INTERNAL_SERVER_ERROR);
    this.name = this.constructor.name;
  }
}

export function validateFHIRAndExtractPatient(patient: FHIRPatient): PatientData {
  const firstName = patient.name?.[0]?.given?.[0]; // TODO we are taking the first index here but there might be multiple given names
  if (!firstName) {
    throw new XDSRegistryError("Given name is not defined");
  }
  const lastName = patient.name?.[0]?.family;
  if (!lastName) {
    throw new XDSRegistryError("Family name is not defined");
  }
  const birthDate = patient.birthDate;
  if (!birthDate) {
    throw new XDSRegistryError("Birth date is not defined");
  }

  const genderAtBirth =
    patient.gender === "male" ? "M" : patient.gender === "female" ? "F" : undefined;
  if (!genderAtBirth) {
    throw new LivingSubjectAdministrativeGenderRequestedError("Gender at Birth is not defined");
  }

  const addresses = (patient.address ?? []).map((addr: FHIRAddress) => {
    const addressLine1 = addr.line ? addr.line.join(" ") : "";
    const city = addr.city || "";
    const state = addr.state ? getStateEnum(addr.state) : undefined;
    const zip = addr.postalCode || "";
    const country = addr.country || "USA";

    if (!addressLine1) {
      throw new PatientAddressRequestedError("Address Line 1 is not defined");
    }
    if (!city) {
      throw new PatientAddressRequestedError("City is not defined");
    }
    if (!state) {
      throw new PatientAddressRequestedError("State is not defined");
    }
    if (!zip) {
      throw new PatientAddressRequestedError("Zip is not defined");
    }

    const newAddress: Address = {
      addressLine1,
      city,
      state,
      zip,
      country,
    };
    return newAddress;
  });

  const contacts = (patient.telecom ?? []).map((tel: ContactPoint) => {
    const contact: Contact = {};
    if (tel.system && isContactType(tel.system)) {
      contact[tel.system] = tel.value;
    }
    return contact;
  });

  const personalIdentifiers = (patient.identifier ?? [])
    .map((identifier: Identifier) => {
      const system = identifier.system;
      const value = identifier.value;
      if (system && value && stateMappings[system]) {
        const state = stateMappings[system];
        if (state) {
          const personalIdentifier: PersonalIdentifier = {
            type: "driversLicense",
            value: value,
            state: state,
          };
          return personalIdentifier;
        }
      }
      return undefined;
    })
    .filter((item): item is PersonalIdentifier => item !== undefined);

  const convertedPatient: PatientData = {
    firstName: firstName,
    lastName: lastName,
    dob: birthDate,
    genderAtBirth: genderAtBirth,
    address: addresses,
    contact: contacts,
    personalIdentifiers: personalIdentifiers,
  };
  return convertedPatient;
}

export const stateMappings: { [key: string]: USState } = {
  "urn:oid:2.16.840.1.113883.4.3.2": USState.AK, // Alaska Driver's License
  "urn:oid:2.16.840.1.113883.4.3.1": USState.AL, // Alabama Driver's License
  "urn:oid:2.16.840.1.113883.4.3.5": USState.AR, // Arkansas Driver's License
  "urn:oid:2.16.840.1.113883.4.3.4": USState.AZ, // Arizona Driver's License
  "urn:oid:2.16.840.1.113883.4.3.6": USState.CA, // California Driver's License
  "urn:oid:2.16.840.1.113883.4.3.8": USState.CO, // Colorado Driver's License
  "urn:oid:2.16.840.1.113883.4.3.9": USState.CT, // Connecticut Driver's License
  "urn:oid:2.16.840.1.113883.4.3.11": USState.DC, // DC Driver's License
  "urn:oid:2.16.840.1.113883.4.3.10": USState.DE, // Delaware Driver's License
  "urn:oid:2.16.840.1.113883.4.3.12": USState.FL, // Florida Driver's License
  "urn:oid:2.16.840.1.113883.4.3.13": USState.GA, // Georgia Driver's License
  "urn:oid:2.16.840.1.113883.4.3.15": USState.HI, // Hawaii Driver's License
  "urn:oid:2.16.840.1.113883.4.3.18": USState.IN, // Indiana Driver's License
  "urn:oid:2.16.840.1.113883.4.3.19": USState.IA, // Iowa Driver's License
  "urn:oid:2.16.840.1.113883.4.3.16": USState.ID, // Idaho Driver's License
  "urn:oid:2.16.840.1.113883.4.3.17": USState.IL, // Illinois Driver's License
  "urn:oid:2.16.840.1.113883.4.3.20": USState.KS, // Kansas Driver's License
  "urn:oid:2.16.840.1.113883.4.3.21": USState.KY, // Kentucky Driver's License
  "urn:oid:2.16.840.1.113883.4.3.22": USState.LA, // Louisiana Driver's License
  "urn:oid:2.16.840.1.113883.4.3.25": USState.MA, // Massachusetts Driver's License
  "urn:oid:2.16.840.1.113883.4.3.24": USState.MD, // Maryland Driver's License
  "urn:oid:2.16.840.1.113883.4.3.23": USState.ME, // Maine Driver's License
  "urn:oid:2.16.840.1.113883.4.3.26": USState.MI, // Michigan Driver's License
  "urn:oid:2.16.840.1.113883.4.3.27": USState.MN, // Minnesota Driver's License
  "urn:oid:2.16.840.1.113883.4.3.29": USState.MO, // Missouri Driver's License
  "urn:oid:2.16.840.1.113883.4.3.28": USState.MS, // Mississippi Driver's License
  "urn:oid:2.16.840.1.113883.4.3.30": USState.MT, // Montana Driver's License
  "urn:oid:2.16.840.1.113883.4.3.36": USState.NY, // New York Driver's License
  "urn:oid:2.16.840.1.113883.4.3.37": USState.NC, // North Carolina Driver's License
  "urn:oid:2.16.840.1.113883.4.3.38": USState.ND, // North Dakota Driver's License
  "urn:oid:2.16.840.1.113883.4.3.31": USState.NE, // Nebraska Driver's License
  "urn:oid:2.16.840.1.113883.4.3.33": USState.NH, // New Hampshire Driver's License
  "urn:oid:2.16.840.1.113883.4.3.34": USState.NJ, // New Jersey Driver's License
  "urn:oid:2.16.840.1.113883.4.3.35": USState.NM, // New Mexico Driver's License
  "urn:oid:2.16.840.1.113883.4.3.32": USState.NV, // Nevada Driver's License
  "urn:oid:2.16.840.1.113883.4.3.39": USState.OH, // Ohio Driver's License
  "urn:oid:2.16.840.1.113883.4.3.40": USState.OK, // Oklahoma Driver's License
  "urn:oid:2.16.840.1.113883.4.3.41": USState.OR, // Oregon Driver's License
  "urn:oid:2.16.840.1.113883.4.3.42": USState.PA, // Pennsylvania Driver's License
  "urn:oid:2.16.840.1.113883.4.3.44": USState.RI, // Rhode Island Driver's License
  "urn:oid:2.16.840.1.113883.4.3.45": USState.SC, // South Carolina Driver's License
  "urn:oid:2.16.840.1.113883.4.3.46": USState.SD, // South Dakota Driver's License
  "urn:oid:2.16.840.1.113883.4.3.47": USState.TN, // Tennessee Driver's License
  "urn:oid:2.16.840.1.113883.4.3.48": USState.TX, // Texas Driver's License
  "urn:oid:2.16.840.1.113883.4.3.49": USState.UT, // Utah Driver's License
  "urn:oid:2.16.840.1.113883.4.3.51": USState.VA, // Virginia Driver's License
  "urn:oid:2.16.840.1.113883.4.3.50": USState.VT, // Vermont Driver's License
  "urn:oid:2.16.840.1.113883.4.3.53": USState.WA, // Washington Driver's License
  "urn:oid:2.16.840.1.113883.4.3.55": USState.WI, // Wisconsin Driver's License
  "urn:oid:2.16.840.1.113883.4.3.54": USState.WV, // West Virginia Driver's License
  "urn:oid:2.16.840.1.113883.4.3.56": USState.WY, // Wyoming Driver's License
};
