import { FlatFileDetail } from "./schema/response";

import { getMedication } from "./fhir/medication";
import { getMedicationDispense } from "./fhir/medication-dispense";
import { getMedicationRequest } from "./fhir/medication-request";
import { getPrescriber } from "./fhir/prescriber";
import { getPharmacy } from "./fhir/pharmacy";
import { getPatient } from "./fhir/patient";
import { getCondition } from "./fhir/condition";
import { IncomingFlatFile } from "./schema/response";
import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";

export async function convertFlatFile(flatFile: IncomingFlatFile): Promise<Bundle[]> {
  // Group rows by patient ID
  const patientIdToRows = new Map<string, FlatFileDetail[]>();
  for (const row of flatFile.detail) {
    const patientId = row.patientId;
    if (!patientIdToRows.has(patientId)) {
      patientIdToRows.set(patientId, []);
    }
    patientIdToRows.get(patientId)?.push(row);
  }

  const bundles: Bundle[] = [];
  for (const [patientId, rows] of patientIdToRows.entries()) {
    const fhirBundle = await convertFlatFileDetailsForPatient(patientId, rows);
    bundles.push(fhirBundle);
  }
  return bundles;
}

async function convertFlatFileDetailsForPatient(
  id: string,
  details: FlatFileDetail[]
): Promise<Bundle> {
  const bundle: Bundle = {
    resourceType: "Bundle",
    total: 0,
    type: "collection",
    entry: [],
  };

  for (const detail of details) {
    const entries = parseFlatFileDetail(detail);
    bundle.entry?.push(...entries);
    bundle.total = (bundle.total ?? 0) + entries.length;
  }

  return bundle;
}

export function parseFlatFileDetail(detail: FlatFileDetail): BundleEntry<Resource>[] {
  const patient = getPatient(detail);
  const practitioner = getPrescriber(detail);
  const pharmacy = getPharmacy(detail);
  const condition = getCondition(detail);
  const medication = getMedication(detail);
  const medicationDispense = getMedicationDispense(detail);
  const medicationRequest = getMedicationRequest(detail);

  const entries: BundleEntry<Resource>[] = [];
  if (patient) {
    entries.push({
      resource: patient,
    });
  }
  if (medication) {
    entries.push({
      resource: medication,
    });
  }
  if (medicationDispense) {
    entries.push({
      resource: medicationDispense,
    });
  }
  if (medicationRequest) {
    entries.push({
      resource: medicationRequest,
    });
  }
  if (practitioner) {
    entries.push({
      resource: practitioner,
    });
  }
  if (pharmacy) {
    entries.push({
      resource: pharmacy,
    });
  }
  if (condition) {
    entries.push({
      resource: condition,
    });
  }

  return entries;
}
