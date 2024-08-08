import {
  MedicationAdministration,
  MedicationAdministrationDosage,
  MedicationStatement,
  Dosage,
} from "@medplum/fhirtypes";

export function convertMedicationAdministrationToStatement(
  medAdmin: MedicationAdministration
): MedicationStatement {
  const medStatement: MedicationStatement = {
    resourceType: "MedicationStatement",
    id: medAdmin.id,
    meta: medAdmin.meta,
    implicitRules: medAdmin.implicitRules,
    language: medAdmin.language,
    text: medAdmin.text,
    contained: medAdmin.contained,
    extension: medAdmin.extension,
    modifierExtension: medAdmin.modifierExtension,
    identifier: medAdmin.identifier,
    partOf: medAdmin.partOf,
    status: convertStatus(medAdmin.status),
    statusReason: medAdmin.statusReason,
    category: medAdmin.category,
    medicationCodeableConcept: medAdmin.medicationCodeableConcept,
    medicationReference: medAdmin.medicationReference,
    subject: medAdmin.subject,
    context: medAdmin.context,
    effectiveDateTime: medAdmin.effectiveDateTime,
    effectivePeriod: medAdmin.effectivePeriod,
    derivedFrom: [],
    reasonCode: medAdmin.reasonCode,
    reasonReference: medAdmin.reasonReference,
    note: medAdmin.note,
    dosage: convertDosage(medAdmin.dosage),
  };

  return medStatement;
}

function convertStatus(status: MedicationAdministration["status"]): MedicationStatement["status"] {
  const statusMapping: { [key: string]: MedicationStatement["status"] } = {
    completed: "completed",
    "entered-in-error": "entered-in-error",
    "in-progress": "active",
    stopped: "stopped",
    // Add more mappings as required
  };

  const mappedStatus = status ? statusMapping[status] : "unknown";
  return mappedStatus;
}

function convertDosage(dosage: MedicationAdministrationDosage | undefined): Dosage[] {
  if (!dosage) return [];

  const convertedDosage: Dosage = {
    text: dosage.text,
    site: dosage.site,
    route: dosage.route,
    method: dosage.method,
    doseAndRate: [
      {
        doseQuantity: dosage.dose,
        rateRatio: dosage.rateRatio,
        rateQuantity: dosage.rateQuantity,
      },
    ],
    timing: {},
  };

  return [convertedDosage];
}
