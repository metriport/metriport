import { Address as FHIRAddress, ContactPoint, Identifier } from "@medplum/fhirtypes";
import { InboundPatientDiscoveryReq } from "../ihe-gateway-types";
import { getStateEnum } from "../../../domain/geographic-locations";
import { Address } from "../../../domain/address";
import { Contact } from "../../../domain/contact";
import { PatientData, PersonalIdentifier } from "../../../domain/patient";
import { isContactType } from "../../fhir/patient/index";
import {
  XDSRegistryError,
  LivingSubjectAdministrativeGenderRequestedError,
  PatientAddressRequestedError,
} from "../error";
import { STATE_MAPPINGS } from "../shared";

export function validateFHIRAndExtractPatient(payload: InboundPatientDiscoveryReq): PatientData {
  const patient = payload.patientResource;
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
      if (system && value && STATE_MAPPINGS[system]) {
        const state = STATE_MAPPINGS[system];
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
    .filter(
      (item: PersonalIdentifier | undefined): item is PersonalIdentifier => item !== undefined
    );

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
