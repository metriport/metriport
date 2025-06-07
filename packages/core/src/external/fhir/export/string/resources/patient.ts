import { Patient } from "@medplum/fhirtypes";
import { FHIRResourceToString } from "../fhir-resource-to-string";
import { formatAddresses } from "../shared/address";
import { formatHumanNames } from "../shared/human-name";
import { formatIdentifiers } from "../shared/identifier";
import { FIELD_SEPARATOR } from "../shared/separator";
import { formatTelecoms } from "../shared/telecom";

/**
 * Converts a FHIR Patient resource to a string representation
 */
export class PatientToString implements FHIRResourceToString<Patient> {
  toString(patient: Patient, isDebug?: boolean): string | undefined {
    const parts: string[] = [];

    const identifierStr = formatIdentifiers({ identifiers: patient.identifier });
    if (identifierStr) parts.push(identifierStr);

    const nameStr = formatHumanNames({ names: patient.name, isDebug });
    if (nameStr) parts.push(nameStr);

    const telecoms = formatTelecoms({ telecoms: patient.telecom, isDebug });
    if (telecoms) parts.push(telecoms);

    const addressStr = formatAddresses({ addresses: patient.address, label: "Address", isDebug });
    if (addressStr) parts.push(addressStr);

    if (patient.birthDate) parts.push(isDebug ? `DOB: ${patient.birthDate}` : patient.birthDate);

    if (patient.gender) parts.push(isDebug ? `Gender: ${patient.gender}` : patient.gender);

    return parts.join(FIELD_SEPARATOR);
  }
}
