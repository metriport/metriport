import {
  Address as IheAddress,
  InboundPatientDiscoveryReq,
  PersonalIdentifier as IheIdentifier,
  Telecom as IheTelecom,
} from "@metriport/ihe-gateway-sdk";
import { Address } from "../../../domain/address";
import { Contact } from "../../../domain/contact";
import { getStateEnum } from "../../../domain/geographic-locations";
import { createDriversLicensePersonalIdentifier, PatientData } from "../../../domain/patient";
import { mapFhirToMetriportGender } from "../../fhir/patient/conversion";
import { isContactType } from "../../fhir/patient/shared";
import {
  LivingSubjectAdministrativeGenderRequestedError,
  PatientAddressRequestedError,
  XDSRegistryError,
} from "../error";
import { STATE_MAPPINGS } from "../shared";

export function validateFHIRAndExtractPatient(payload: InboundPatientDiscoveryReq): PatientData {
  const patient = payload.patientResource;
  const firstName = patient.name?.flatMap(n => n.given ?? []).join(",");

  if (!firstName) {
    throw new XDSRegistryError("Given name is not defined");
  }
  const lastName = patient.name?.flatMap(n => n.family ?? []).join(",");
  if (!lastName) {
    throw new XDSRegistryError("Family name is not defined");
  }
  const birthDate = patient.birthDate;
  if (!birthDate) {
    throw new XDSRegistryError("Birth date is not defined");
  }

  const genderAtBirth = mapFhirToMetriportGender(patient.gender);
  if (!genderAtBirth) {
    throw new LivingSubjectAdministrativeGenderRequestedError("Gender at Birth is not defined");
  }

  const addresses = (patient.address ?? []).map((addr: IheAddress) => {
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

  const contacts = (patient.telecom ?? []).map((tel: IheTelecom) => {
    const contact: Contact = {};
    if (tel.system && isContactType(tel.system)) {
      contact[tel.system] = tel.value;
    }
    return contact;
  });

  const personalIdentifiers = (patient.identifier ?? []).flatMap((identifier: IheIdentifier) => {
    const system = identifier.system;
    const value = identifier.value;
    if (system && value && STATE_MAPPINGS[system]) {
      const state = STATE_MAPPINGS[system];
      if (state) {
        return createDriversLicensePersonalIdentifier(value, state);
      }
    }
    return [];
  });

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
