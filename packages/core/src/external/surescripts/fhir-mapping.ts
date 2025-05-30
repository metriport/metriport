import {
  Medication,
  MedicationIngredient,
  MedicationRequest,
  MedicationDispense,
  Practitioner,
  MedicationDispensePerformer,
  Patient,
  Organization,
} from "@medplum/fhirtypes";
import { convertDateToString } from "@metriport/shared/common/date";
import { FlatFileDetail } from "./schema/response";

export async function parseFlatFileDetail(detail: FlatFileDetail) {
  const patient = parsePatient(detail);
  const medication = await parseMedication(detail);
  const medicationDispense = parseMedicationDispense(detail);
  const medicationRequest = await parseMedicationRequest(detail);
  const practitioner = parsePractitioner(detail);
  const pharmacy = parsePharmacy(detail);

  return {
    patient,
    medication,
    medicationDispense,
    medicationRequest,
    practitioner,
    pharmacy,
  };
}

async function parseMedication(detail: FlatFileDetail): Promise<Medication> {
  const [code, ingredient] = await Promise.all([
    parseMedicationCode(detail),
    parseMedicationIngredient(detail),
  ]);

  return {
    resourceType: "Medication",
    ...(code ? { code } : null),
    ...(ingredient && ingredient.length > 0 ? { ingredient } : null),
    extension: [
      {
        url: "http://hl7.org/fhir/StructureDefinition/medication-package-item",
        valueCodeableConcept: {
          coding: [
            {
              system: "http://www.nlm.nih.gov/research/umls/",
              code: detail.deaSchedule ?? "",
              display: detail.deaSchedule ?? "",
            },
          ],
        },
      },
    ],
  };
}

async function parseMedicationCode(detail: FlatFileDetail): Promise<Medication["code"]> {
  if (!detail.ndcNumber) return undefined;
  // TODO: do a terminology lookup

  // TODO: incorporate these
  detail.productCode;
  detail.productCodeQualifier;

  return {
    coding: [
      {
        system: "http://www.nlm.nih.gov/research/umls/",
        code: detail.ndcNumber,
        display: detail.drugDescription ?? "",
      },
    ],
  };
}

async function parseMedicationIngredient(
  detail: FlatFileDetail
): Promise<MedicationIngredient[] | null> {
  if (!detail.strengthValue || !detail.strengthFormCode || !detail.strengthUnitOfMeasure)
    return null;

  return [
    {
      strength: {
        numerator: {
          value: Number(detail.strengthValue),
          unit: detail.strengthUnitOfMeasure,
          system: "http://unitsofmeasure.org",
          code: detail.strengthFormCode,
        },
        denominator: {
          value: 1,
        },
      },
    },
  ];
}

async function parseMedicationRequest(detail: FlatFileDetail): Promise<MedicationRequest> {
  const dosageInstruction = await parseMedicationRequestTiming(detail);
  const substitution = await parseMedicationRequestSubstitution(detail);

  return {
    resourceType: "MedicationRequest",
    ...(dosageInstruction && dosageInstruction.length > 0 ? { dosageInstruction } : null),
    ...(detail.dateWritten ? { authoredOn: detail.dateWritten.toISOString() } : null),
    ...(substitution ? { substitution } : null),
  };
}

async function parseMedicationRequestTiming(
  detail: FlatFileDetail
): Promise<MedicationRequest["dosageInstruction"]> {
  if (!detail.startDate || !detail.endDate) return [];
  return [
    {
      timing: {},
    },
  ];
}

async function parseMedicationRequestSubstitution(
  detail: FlatFileDetail
): Promise<MedicationRequest["substitution"]> {
  if (!detail.substitutions) return undefined;
  return {
    // allowedBoolean: detail.substitutions === "Y",
  };
}

function parsePractitioner(detail: FlatFileDetail): Practitioner {
  const practitionerName = parsePractitionerName(detail);

  return {
    resourceType: "Practitioner",
    identifier: [
      {
        system: "http://hl7.org/fhir/sid/us-npi",
        value: detail.prescriberNPI,
      },
    ],
    ...(practitionerName && practitionerName.length > 0 ? { name: practitionerName } : null),
  };
}

function parsePractitionerName(detail: FlatFileDetail): Practitioner["name"] {
  if (!detail.prescriberFirstName || !detail.prescriberLastName) return [];

  const givenNames = [detail.prescriberFirstName];
  if (detail.prescriberMiddleName) givenNames.push(...detail.prescriberMiddleName.split(" "));
  const address = parsePractitionerAddress(detail);

  return [
    {
      given: givenNames,
      family: detail.prescriberLastName,
      ...(detail.prescriberPrefix ? { prefix: [detail.prescriberPrefix] } : null),
      ...(detail.prescriberSuffix ? { suffix: [detail.prescriberSuffix] } : null),
      ...(address ? { address } : null),
    },
  ];
}

function parsePractitionerAddress(detail: FlatFileDetail): Practitioner["address"] {
  if (
    !detail.prescriberAddressLine1 ||
    !detail.prescriberCity ||
    !detail.prescriberState ||
    !detail.prescriberZipCode
  )
    return undefined;

  return [
    {
      line: [detail.prescriberAddressLine1, detail.prescriberAddressLine2].filter(
        (line): line is string => Boolean(line)
      ),
      city: detail.prescriberCity,
      state: detail.prescriberState,
      postalCode: detail.prescriberZipCode,
    },
  ];
}

function parsePharmacy(detail: FlatFileDetail): Organization | undefined {
  if (!detail.pharmacyNpiNumber || !detail.pharmacyName) return undefined;

  const address = parsePharmacyAddress(detail);
  const telecom = parsePharmacyTelecom(detail);

  return {
    resourceType: "Organization",
    identifier: [
      {
        system: "http://hl7.org/fhir/sid/us-npi",
        value: detail.pharmacyNpiNumber,
      },
    ],
    name: detail.pharmacyName,
    ...(address && address.length > 0 ? { address } : null),
    ...(telecom && telecom.length > 0 ? { telecom } : null),
  };
}

function parsePharmacyAddress(detail: FlatFileDetail): Organization["address"] {
  if (
    !detail.pharmacyAddressLine1 ||
    !detail.pharmacyCity ||
    !detail.pharmacyState ||
    !detail.pharmacyZipCode
  )
    return undefined;

  return [
    {
      line: [detail.pharmacyAddressLine1, detail.pharmacyAddressLine2].filter(
        (line): line is string => Boolean(line)
      ),
      city: detail.pharmacyCity,
      state: detail.pharmacyState,
      postalCode: detail.pharmacyZipCode,
    },
  ];
}

function parsePharmacyTelecom(detail: FlatFileDetail): Organization["telecom"] {
  const telecom: Organization["telecom"] = [];
  if (detail.pharmacyPhoneNumber)
    telecom.push({
      system: "phone",
      value: detail.pharmacyPhoneNumber,
    });
  if (detail.pharmacyFaxNumber)
    telecom.push({
      system: "fax",
      value: detail.pharmacyFaxNumber,
    });
  return telecom;
}

function parsePatient(detail: FlatFileDetail): Patient {
  return {
    resourceType: "Patient",
    id: detail.patientId,
    name: [
      {
        given: [detail.patientFirstName],
        family: detail.patientLastName,
      },
    ],
    birthDate: convertDateToString(detail.patientDOB, { separator: "-" }),

    // gender: detail.patientGender,
  };
}

function parseMedicationDispense(detail: FlatFileDetail): MedicationDispense {
  const daysSupply = parseDaysSupply(detail);
  const performer = parseMedicationDispensePerformer(detail);

  const medicationDispense: MedicationDispense = {
    resourceType: "MedicationDispense",
    subject: { reference: detail.patientId },
    status: "completed",
    ...(daysSupply ? { daysSupply } : null),
    ...(performer.length > 0 ? { performer } : null),
  };

  return medicationDispense;
}

function parseMedicationDispensePerformer(detail: FlatFileDetail): MedicationDispensePerformer[] {
  return [
    {
      id: "",

      actor: {
        reference: `Practitioner/${detail.prescriberNPI}`,
        display: detail.prescriberNPI,
      },
    },
  ];
}

function parseDaysSupply(detail: FlatFileDetail): MedicationDispense["daysSupply"] | null {
  if (!detail.daysSupply) return null;

  const value = parseInt(detail.daysSupply);
  if (!Number.isFinite(value)) return null;

  return {
    value,
    unit: "day",
    system: "http://unitsofmeasure.org",
    code: "d",
  };
}
