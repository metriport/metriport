import { Patient } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../types";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatIdentifiers } from "../shared/identifier";
import { formatHumanNames } from "../shared/human-name";
import { formatAddresses } from "../shared/address";

/**
 * Converts a FHIR Patient resource to a string representation
 */
export class PatientToString implements FHIRResourceToString<Patient> {
  toString(patient: Patient): string {
    const parts: string[] = [];

    // Add identifier
    const identifierStr = formatIdentifiers(patient.identifier);
    if (identifierStr) {
      parts.push(identifierStr);
    }

    // Add name
    const nameStr = formatHumanNames(patient.name);
    if (nameStr) {
      parts.push(nameStr);
    }

    // Add address
    const addressStr = formatAddresses(patient.address);
    if (addressStr) {
      parts.push(addressStr);
    }

    // Add birth date
    if (patient.birthDate) {
      parts.push(`DOB: ${patient.birthDate}`);
    }

    // Add gender
    if (patient.gender) {
      parts.push(`Gender: ${patient.gender}`);
    }

    return parts.join(FIELD_SEPARATOR);
  }
}
