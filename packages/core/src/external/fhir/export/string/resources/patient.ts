import { Patient } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAddresses } from "../shared/address";
import { formatHumanNames } from "../shared/human-name";
import { formatIdentifiers } from "../shared/identifier";
import { FIELD_SEPARATOR } from "../shared/separator";

/**
 * Converts a FHIR Patient resource to a string representation
 */
export class PatientToString implements FHIRResourceToString<Patient> {
  toString(patient: Patient): string | undefined {
    const parts: string[] = [];

    const identifierStr = formatIdentifiers(patient.identifier);
    if (identifierStr) parts.push(identifierStr);

    const nameStr = formatHumanNames(patient.name);
    if (nameStr) parts.push(nameStr);

    const addressStr = formatAddresses(patient.address, "Address");
    if (addressStr) parts.push(addressStr);

    if (patient.birthDate) parts.push(`DOB: ${patient.birthDate}`);

    if (patient.gender) parts.push(`Gender: ${patient.gender}`);

    return parts.join(FIELD_SEPARATOR);
  }
}
