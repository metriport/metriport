import { Patient as FHIRPatient, Address as FHIRAddress, ContactPoint } from "@medplum/fhirtypes";
import { USState, getStateEnum } from "../../domain/geographic-locations";
import { PatientDataMPI, Address, Contact } from "../mpi/patient-incoming-schema";

export class PatientAddressRequestedError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "PatientAddressRequestedError";
  }
}

export class LivingSubjectAdministrativeGenderRequestedError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "LivingSubjectAdministrativeGenderRequestedError";
  }
}

export class InternalError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "InternalError";
  }
}

export function validateFHIRAndExtractPatient(patient: FHIRPatient): PatientDataMPI {
  const firstName = patient.name?.[0]?.given?.[0];
  if (!firstName) {
    throw new InternalError("Given name is not defined");
  }
  const lastName = patient.name?.[0]?.family;
  if (!lastName) {
    throw new InternalError("Family name is not defined");
  }
  const birthDate = patient.birthDate;
  if (!birthDate) {
    throw new InternalError("Birth date is not defined");
  }
  const genderAtBirth = patient.gender;
  if (!genderAtBirth) {
    throw new LivingSubjectAdministrativeGenderRequestedError("Gender at Birth is not defined");
  }

  const addresses = (patient.address ?? []).map((addr: FHIRAddress) => {
    const addressLine1 = addr.line ? addr.line.join(" ") : "";
    const city = addr.city || "";
    const state = addr.state ? getStateEnum(addr.state) : USState.CA;
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
    if (tel.system) {
      contact[tel.system] = tel.value;
    }
    return contact;
  });

  const patientDataMPI: PatientDataMPI = {
    id: patient.id || "",
    firstName: firstName,
    lastName: lastName,
    dob: birthDate,
    genderAtBirth: patient.gender === "male" ? "M" : "F",
    address: addresses,
    contact: contacts,
  };
  return patientDataMPI;
}
